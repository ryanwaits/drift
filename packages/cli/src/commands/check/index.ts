import * as path from 'node:path';
import {
  aggregateResults,
  buildDocCovSpec,
  createPackageResult,
  DocCov,
  type ExampleValidation,
  findEntryPointForFile,
  IncrementalAnalyzer,
  NodeFileSystem,
  type PackageResult,
  type PartialAnalysisState,
  parseExamplesFlag,
  resolveTarget,
} from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import { glob } from 'glob';
import { loadDocCovConfig } from '../../config';
import { mergeFilterOptions, parseVisibilityFlag } from '../../utils/filter-options';
import { spinner } from '../../utils/progress';
import { clampPercentage } from '../../utils/validation';
import { handleFixes, handleForgottenExportFixes } from './fix-handler';
import {
  displayApiSurfaceOutput,
  displayBatchTextOutput,
  displayTextOutput,
  handleBatchNonTextOutput,
  handleNonTextOutput,
} from './output';
import type { CheckCommandDependencies, CollectedDrift, OutputFormat } from './types';
import { collect, collectDrift } from './utils';
import { runExampleValidation, validateMarkdownDocs } from './validation';
import {
  clearIncrementalAnalyzer,
  registerSignalHandlers,
  setIncrementalAnalyzer,
} from '../../utils/signal-handler';

const defaultDependencies: Required<CheckCommandDependencies> = {
  createDocCov: (options) => new DocCov(options),
  log: console.log,
  error: console.error,
};

export function registerCheckCommand(
  program: Command,
  dependencies: CheckCommandDependencies = {},
): void {
  const { createDocCov, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('check [targets...]')
    .description('Check documentation coverage and output reports')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--package <name>', 'Target package name (for monorepos)')
    .option('--min-health <percentage>', 'Minimum health score (0-100)', (value) => Number(value))
    .option(
      '--examples [mode]',
      'Example validation: presence, typecheck, run (comma-separated). Bare flag runs all.',
    )
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .option('--docs <glob>', 'Glob pattern for markdown docs to check for stale refs', collect, [])
    .option('--fix', 'Auto-fix drift issues')
    .option('--preview', 'Preview fixes with diff output (implies --fix)')
    .option('--format <format>', 'Output format: text, json, markdown', 'text')
    .option('-o, --output <file>', 'Custom output path (overrides default .doccov/ path)')
    .option('--stdout', 'Output to stdout instead of writing to .doccov/')
    .option('--limit <n>', 'Max exports to show in report tables', '20')
    .option(
      '--max-type-depth <number>',
      'Maximum depth for type conversion (default: 20)',
      (value) => {
        const n = parseInt(value, 10);
        if (Number.isNaN(n) || n < 1)
          throw new Error('--max-type-depth must be a positive integer');
        return n;
      },
    )
    .option('--no-cache', 'Bypass spec cache and force regeneration')
    .option(
      '--visibility <tags>',
      'Filter by release stage: public,beta,alpha,internal (comma-separated)',
    )
    .option('--api-surface', 'Show only API surface / forgotten exports info')
    .option('-v, --verbose', 'Show detailed output including forgotten exports')
    .action(async (targets: string[], options) => {
      // Register signal handlers for graceful shutdown
      registerSignalHandlers();

      try {
        const spin = spinner('Analyzing...');

        // Expand glob patterns in targets
        const resolvedTargets = await expandGlobTargets(targets, options.cwd);
        const isBatchMode = resolvedTargets.length > 1;

        // Parse --examples flag (may be overridden by config later)
        let validations = parseExamplesFlag(options.examples);
        let hasExamples = validations.length > 0;

        // If batch mode, run batch analysis
        if (isBatchMode) {
          await runBatchAnalysis(resolvedTargets, options, { createDocCov, log, error, spin });
          return;
        }

        // Single target mode (original behavior)
        const entry = resolvedTargets[0];

        // Resolve target directory and entry point
        const fileSystem = new NodeFileSystem(options.cwd);
        const resolved = await resolveTarget(fileSystem, {
          cwd: options.cwd,
          package: options.package,
          entry: entry as string | undefined,
        });

        const { targetDir, entryFile } = resolved;

        // Load config to get minCoverage threshold
        const config = await loadDocCovConfig(targetDir);

        // Merge examples config if CLI flag not set
        if (!hasExamples && config?.check?.examples) {
          const configExamples = config.check.examples;
          if (Array.isArray(configExamples)) {
            validations = configExamples as ExampleValidation[];
          } else if (typeof configExamples === 'string') {
            validations = parseExamplesFlag(configExamples);
          }
          hasExamples = validations.length > 0;
        }

        // CLI option takes precedence, then config, then sensible defaults
        const DEFAULT_MIN_HEALTH = 80;
        const minHealthRaw = options.minHealth ?? config?.check?.minHealth ?? DEFAULT_MIN_HEALTH;
        const minHealth = clampPercentage(minHealthRaw);

        // API surface config: apiSurface.minCompleteness only (--min-api-surface removed)
        const apiSurfaceConfig = config?.check?.apiSurface;
        const minApiSurfaceRaw = apiSurfaceConfig?.minCompleteness;
        const minApiSurface =
          minApiSurfaceRaw !== undefined ? clampPercentage(minApiSurfaceRaw) : undefined;
        const warnBelowApiSurface = apiSurfaceConfig?.warnBelow
          ? clampPercentage(apiSurfaceConfig.warnBelow)
          : undefined;
        const apiSurfaceIgnore = apiSurfaceConfig?.ignore ?? [];

        // Parse and merge visibility filters
        const cliFilters = {
          include: undefined,
          exclude: undefined,
          visibility: parseVisibilityFlag(options.visibility),
        };
        const resolvedFilters = mergeFilterOptions(config, cliFilters);

        // Log filter info if any filters are applied
        if (resolvedFilters.visibility) {
          log(chalk.dim(`Filtering by visibility: ${resolvedFilters.visibility.join(', ')}`));
        }

        const resolveExternalTypes = !options.skipResolve;

        const analyzer = createDocCov({
          resolveExternalTypes,
          maxDepth: options.maxTypeDepth,
          useCache: options.cache !== false,
          cwd: targetDir, // Use resolved target dir for consistent caching
        });

        // Build analysis options with visibility filters
        const analyzeOptions = resolvedFilters.visibility
          ? { filters: { visibility: resolvedFilters.visibility } }
          : {};

        const specResult = await analyzer.analyzeFileWithDiagnostics(entryFile, analyzeOptions);

        if (!specResult) {
          spin.fail('Analysis failed');
          throw new Error('Failed to analyze documentation coverage.');
        }

        // Build DocCov spec with coverage data (composition pattern)
        const openpkg = specResult.spec as OpenPkg;
        spin.update('Building coverage spec...');

        // Auto-detect entry point exports when analyzing a sub-file
        // This filters out "forgotten" exports that are actually exported from the main entry
        let entryExportNames: string[] | undefined;
        const entryResult = await findEntryPointForFile(fileSystem, entryFile);
        if (entryResult) {
          const pkgEntryPath = path.resolve(entryResult.packagePath, entryResult.entryPoint.path);
          const isSubFile = path.resolve(entryFile) !== pkgEntryPath;

          if (isSubFile) {
            // Analyze the entry point to get its exports
            const entryAnalyzer = createDocCov({
              resolveExternalTypes: false,
              useCache: options.cache !== false,
              cwd: entryResult.packagePath,
            });
            const entrySpec = await entryAnalyzer.analyzeFileWithDiagnostics(pkgEntryPath);
            if (entrySpec?.spec?.exports) {
              entryExportNames = entrySpec.spec.exports.map((e) => e.name);
            }
          }
        }

        // Set up incremental analyzer for crash recovery
        const incrementalAnalyzer = new IncrementalAnalyzer();
        setIncrementalAnalyzer(incrementalAnalyzer, (partial: PartialAnalysisState) => {
          log(chalk.yellow(`\n⚠️  Partial results (${partial.results.length} exports):`));
          for (const r of partial.results.slice(-5)) {
            log(chalk.dim(`  - ${r.name}: ${r.coverageScore}%`));
          }
          if (partial.results.length > 5) {
            log(chalk.dim(`  ... and ${partial.results.length - 5} more`));
          }
        });

        const doccov = await buildDocCovSpec({
          openpkg,
          openpkgPath: entryFile,
          packagePath: targetDir,
          forgottenExports: specResult.forgottenExports,
          apiSurfaceIgnore,
          entryExportNames,
          onProgress: (current, total, item) => {
            spin.setDetail(`${current}/${total}: ${item}`);
          },
          onExportAnalyzed: async (id, name, analysis) => {
            await incrementalAnalyzer.writeExportAnalysis(id, name, analysis);
          },
        });

        // Clean up incremental analyzer on success
        clearIncrementalAnalyzer();
        await incrementalAnalyzer.cleanup();

        const format = (options.format ?? 'text') as OutputFormat;

        // Collect spec diagnostics for later display
        // Filter out EXTERNAL_TYPE_* info diagnostics - not actionable for users
        const specWarnings = specResult.diagnostics.filter((d) => d.severity === 'warning');
        const specInfos = specResult.diagnostics.filter(
          (d) => d.severity === 'info' && !d.code?.startsWith('EXTERNAL_TYPE'),
        );

        // Normalize --fix / --preview
        const isPreview = options.preview;
        const shouldFix = options.fix || isPreview;

        // Run example validation
        let typecheckErrors: Array<{
          exportName: string;
          error: import('@doccov/sdk').ExampleTypeError;
        }> = [];
        let runtimeDrifts: CollectedDrift[] = [];

        if (hasExamples) {
          const validation = await runExampleValidation(openpkg, {
            validations,
            targetDir,
          });
          typecheckErrors = validation.typecheckErrors;
          runtimeDrifts = validation.runtimeDrifts;
        }

        // Markdown docs analysis: detect stale references
        let docsPatterns = options.docs as string[];
        if (docsPatterns.length === 0 && config?.docs?.include) {
          docsPatterns = config.docs.include;
        }

        const staleRefs = await validateMarkdownDocs({
          docsPatterns,
          targetDir,
          exportNames: (openpkg.exports ?? []).map((e) => e.name),
        });

        const coverageScore = doccov.summary.score;

        // Collect drift issues - exclude example-category drifts unless --examples is used
        const allDriftExports = [...collectDrift(openpkg.exports ?? [], doccov), ...runtimeDrifts];
        let driftExports = hasExamples
          ? allDriftExports
          : allDriftExports.filter((d) => d.category !== 'example');

        // Handle --fix / --preview: auto-fix drift issues
        const healthScore = doccov.summary.health?.score ?? coverageScore;
        if (shouldFix && driftExports.length > 0) {
          const fixResult = await handleFixes(
            openpkg,
            doccov,
            { isPreview, targetDir, entryFile, healthScore },
            { log, error },
          );

          // Filter out fixed drifts from the evaluation (only when actually applying)
          if (!isPreview) {
            driftExports = driftExports.filter(
              (d) => !fixResult.fixedDriftKeys.has(`${d.name}:${d.issue}`),
            );
          }
        }

        // Handle --fix / --preview: auto-fix forgotten exports
        if (shouldFix && doccov.apiSurface?.forgotten.length) {
          await handleForgottenExportFixes(
            doccov,
            { isPreview, targetDir, entryFile },
            { log, error },
          );
        }

        spin.success('Analysis complete');

        // Handle --api-surface focused view
        if (options.apiSurface) {
          displayApiSurfaceOutput(doccov, { log });
          const apiSurfaceScore = doccov.apiSurface?.completeness ?? 100;
          if (minApiSurface !== undefined && apiSurfaceScore < minApiSurface) {
            process.exit(1);
          }
          return;
        }

        // Handle --format output for non-text formats
        if (format !== 'text') {
          const passed = handleNonTextOutput(
            {
              format,
              openpkg,
              doccov,
              minHealth,
              minApiSurface,
              typecheckErrors,
              runtimeErrors: runtimeDrifts.length,
              staleRefs,
              limit: parseInt(options.limit, 10) || 20,
              stdout: options.stdout,
              outputPath: options.output,
              cwd: targetDir,
            },
            { log },
          );

          if (!passed) {
            process.exit(1);
          }
          return;
        }

        // Display text output
        const passed = displayTextOutput(
          {
            openpkg,
            doccov,
            coverageScore,
            minHealth,
            minApiSurface,
            warnBelowApiSurface,
            driftExports,
            typecheckErrors,
            runtimeErrors: runtimeDrifts.length,
            staleRefs,
            specWarnings,
            specInfos,
            verbose: options.verbose ?? false,
          },
          { log },
        );

        if (!passed) {
          process.exit(1);
        }
      } catch (commandError) {
        error(
          chalk.red('Error:'),
          commandError instanceof Error ? commandError.message : commandError,
        );
        process.exit(1);
      }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Analysis Support
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expand glob patterns in target list.
 * Non-glob paths are passed through unchanged.
 */
async function expandGlobTargets(targets: string[], cwd: string): Promise<string[]> {
  if (targets.length === 0) {
    return []; // Will use resolveTarget's default behavior
  }

  const expanded: string[] = [];
  for (const target of targets) {
    if (target.includes('*')) {
      // Expand glob pattern
      const matches = await glob(target, { cwd, nodir: true });
      expanded.push(...matches.map((m) => path.resolve(cwd, m)));
    } else {
      expanded.push(path.resolve(cwd, target));
    }
  }

  return expanded;
}

interface BatchAnalysisDeps {
  createDocCov: (options: import('@doccov/sdk').DocCovOptions) => DocCov;
  log: typeof console.log;
  error: typeof console.error;
  spin: ReturnType<typeof spinner>;
}

/**
 * Run batch analysis across multiple targets.
 */
async function runBatchAnalysis(
  targets: string[],
  options: Record<string, unknown>,
  deps: BatchAnalysisDeps,
): Promise<void> {
  const { createDocCov, log, error, spin } = deps;
  const fileSystem = new NodeFileSystem(options.cwd as string);
  const packageResults: PackageResult[] = [];

  // Analyze each target
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    spin.update(`Analyzing ${i + 1}/${targets.length}: ${path.basename(target)}...`);

    try {
      const resolved = await resolveTarget(fileSystem, {
        cwd: options.cwd as string,
        entry: target,
      });

      const { targetDir, entryFile } = resolved;
      const config = await loadDocCovConfig(targetDir);

      const resolveExternalTypes = !(options.skipResolve as boolean);
      const analyzer = createDocCov({
        resolveExternalTypes,
        maxDepth: options.maxTypeDepth as number | undefined,
        useCache: options.cache !== false,
        cwd: targetDir,
      });

      const specResult = await analyzer.analyzeFileWithDiagnostics(entryFile);
      if (!specResult) {
        log(chalk.yellow(`  Skipping ${target}: analysis failed`));
        continue;
      }

      const openpkg = specResult.spec as OpenPkg;
      const doccov = await buildDocCovSpec({
        openpkg,
        openpkgPath: entryFile,
        packagePath: targetDir,
        forgottenExports: specResult.forgottenExports,
      });

      packageResults.push(createPackageResult(openpkg, doccov, entryFile));
    } catch (err) {
      log(chalk.yellow(`  Skipping ${target}: ${err instanceof Error ? err.message : err}`));
    }
  }

  if (packageResults.length === 0) {
    spin.fail('No packages analyzed successfully');
    process.exit(1);
  }

  spin.success(`Analyzed ${packageResults.length} package(s)`);

  // Aggregate results
  const batchResult = aggregateResults(packageResults);

  // Load config for thresholds (use first target's config)
  const firstTargetDir = path.dirname(targets[0]);
  const config = await loadDocCovConfig(firstTargetDir);

  const DEFAULT_MIN_HEALTH = 80;
  const minHealthRaw =
    (options.minHealth as number | undefined) ?? config?.check?.minHealth ?? DEFAULT_MIN_HEALTH;
  const minHealth = clampPercentage(minHealthRaw);

  const format = ((options.format as string) ?? 'text') as OutputFormat;

  // Handle output
  if (format !== 'text') {
    const passed = handleBatchNonTextOutput(
      {
        format,
        batchResult,
        minHealth,
        limit: parseInt(options.limit as string, 10) || 20,
        stdout: options.stdout as boolean,
        outputPath: options.output as string | undefined,
        cwd: options.cwd as string,
      },
      { log },
    );
    if (!passed) {
      process.exit(1);
    }
    return;
  }

  // Display text output
  const passed = displayBatchTextOutput(
    {
      batchResult,
      minHealth,
      verbose: (options.verbose as boolean) ?? false,
    },
    { log },
  );

  if (!passed) {
    process.exit(1);
  }
}

// Re-export types for consumers
export type {
  CheckCommandDependencies,
  CollectedDrift,
  OutputFormat,
  StaleReference,
} from './types';
