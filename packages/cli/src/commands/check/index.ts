import {
  buildDocCovSpec,
  DocCov,
  type ExampleValidation,
  type ExampleValidationResult,
  NodeFileSystem,
  parseExamplesFlag,
  resolveTarget,
} from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import chalk from 'chalk';
import { spinner } from 'cli-utils';
import type { Command } from 'commander';
import { loadDocCovConfig } from '../../config';
import { mergeFilterOptions, parseVisibilityFlag } from '../../utils/filter-options';
import { clampPercentage } from '../../utils/validation';
import { handleFixes, handleForgottenExportFixes } from './fix-handler';
import { displayApiSurfaceOutput, displayTextOutput, handleNonTextOutput } from './output';
import type { CheckCommandDependencies, CollectedDrift, OutputFormat } from './types';
import { collect, collectDrift } from './utils';
import { runExampleValidation, validateMarkdownDocs } from './validation';

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
    .command('check [entry]')
    .description('Check documentation coverage and output reports')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--package <name>', 'Target package name (for monorepos)')
    .option('--min-health <percentage>', 'Minimum health score (0-100)', (value) => Number(value))
    .option(
      '--min-coverage <percentage>',
      '[deprecated] Use --min-health instead',
      (value) => Number(value),
    )
    .option(
      '--max-drift <percentage>',
      '[deprecated] Use --min-health instead',
      (value) => Number(value),
    )
    .option(
      '--examples [mode]',
      'Example validation: presence, typecheck, run (comma-separated). Bare flag runs all.',
    )
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .option('--docs <glob>', 'Glob pattern for markdown docs to check for stale refs', collect, [])
    .option('--fix', 'Auto-fix drift issues')
    .option('--preview', 'Preview fixes with diff output (implies --fix)')
    .option('--format <format>', 'Output format: text, json, markdown, html, github', 'text')
    .option('-o, --output <file>', 'Custom output path (overrides default .doccov/ path)')
    .option('--stdout', 'Output to stdout instead of writing to .doccov/')
    .option('--update-snapshot', 'Force regenerate .doccov/report.json')
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
    .option(
      '--min-api-surface <percentage>',
      'Minimum API surface completeness percentage (0-100)',
      (value) => Number(value),
    )
    .option('--api-surface', 'Show only API surface / forgotten exports info')
    .option('-v, --verbose', 'Show detailed output including forgotten exports')
    .action(async (entry, options) => {
      try {
        const spin = spinner('Analyzing...');

        // Parse --examples flag (may be overridden by config later)
        let validations = parseExamplesFlag(options.examples);
        let hasExamples = validations.length > 0;

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

        // Deprecation warnings for legacy flags
        if (options.minCoverage !== undefined) {
          log(chalk.yellow('Warning: --min-coverage is deprecated. Use --min-health instead.'));
        }
        if (options.maxDrift !== undefined) {
          log(chalk.yellow('Warning: --max-drift is deprecated. Use --min-health instead.'));
        }
        if (config?.check?.minCoverage !== undefined) {
          log(chalk.yellow('Warning: config.check.minCoverage is deprecated. Use minHealth.'));
        }
        if (config?.check?.maxDrift !== undefined) {
          log(chalk.yellow('Warning: config.check.maxDrift is deprecated. Use minHealth.'));
        }

        // CLI option takes precedence, then config, then sensible defaults
        const DEFAULT_MIN_HEALTH = 80;
        const minHealthRaw =
          options.minHealth ?? config?.check?.minHealth ?? DEFAULT_MIN_HEALTH;
        const minHealth = clampPercentage(minHealthRaw);

        // Legacy: still read minCoverage/maxDrift for backwards compat display
        const minCoverageRaw =
          options.minCoverage ?? config?.check?.minCoverage ?? DEFAULT_MIN_HEALTH;
        const minCoverage = clampPercentage(minCoverageRaw);
        const maxDriftRaw = options.maxDrift ?? config?.check?.maxDrift;
        const maxDrift = maxDriftRaw !== undefined ? clampPercentage(maxDriftRaw) : undefined;

        // API surface config: CLI flag takes precedence, then apiSurface.minCompleteness, then legacy minApiSurface
        const apiSurfaceConfig = config?.check?.apiSurface;
        const minApiSurfaceRaw =
          options.minApiSurface ??
          apiSurfaceConfig?.minCompleteness ??
          config?.check?.minApiSurface;
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
        const doccov = buildDocCovSpec({
          openpkg,
          openpkgPath: entryFile,
          packagePath: targetDir,
          forgottenExports: specResult.forgottenExports,
          apiSurfaceIgnore,
        });
        const format = (options.format ?? 'text') as OutputFormat;

        // Collect spec diagnostics for later display
        const specWarnings = specResult.diagnostics.filter((d) => d.severity === 'warning');
        const specInfos = specResult.diagnostics.filter((d) => d.severity === 'info');

        // Normalize --fix / --preview
        const isPreview = options.preview;
        const shouldFix = options.fix || isPreview;

        // Run example validation
        let exampleResult: ExampleValidationResult | undefined;
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
          exampleResult = validation.result;
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
              coverageScore,
              minHealth,
              minApiSurface,
              driftExports,
              typecheckErrors,
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
            staleRefs,
            exampleResult,
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

// Re-export types for consumers
export type {
  CheckCommandDependencies,
  CollectedDrift,
  OutputFormat,
  StaleReference,
} from './types';
