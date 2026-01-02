import { spinner } from 'cli-utils';
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
import type { Command } from 'commander';
import { loadDocCovConfig } from '../../config';
import { mergeFilterOptions, parseVisibilityFlag } from '../../utils/filter-options';
import { clampPercentage } from '../../utils/validation';
import { handleFixes } from './fix-handler';
import { displayTextOutput, handleNonTextOutput } from './output';
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
    .option('--min-coverage <percentage>', 'Minimum docs coverage percentage (0-100)', (value) =>
      Number(value),
    )
    .option('--max-drift <percentage>', 'Maximum drift percentage allowed (0-100)', (value) =>
      Number(value),
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

        // CLI option takes precedence, then config, then sensible defaults
        const DEFAULT_MIN_COVERAGE = 80;
        const minCoverageRaw =
          options.minCoverage ?? config?.check?.minCoverage ?? DEFAULT_MIN_COVERAGE;
        const minCoverage = clampPercentage(minCoverageRaw);

        // maxDrift has no default - drift is shown but doesn't fail unless configured
        const maxDriftRaw = options.maxDrift ?? config?.check?.maxDrift;
        const maxDrift = maxDriftRaw !== undefined ? clampPercentage(maxDriftRaw) : undefined;

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
          cwd: options.cwd,
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
        if (shouldFix && driftExports.length > 0) {
          const fixResult = await handleFixes(
            openpkg,
            doccov,
            { isPreview, targetDir },
            { log, error },
          );

          // Filter out fixed drifts from the evaluation (only when actually applying)
          if (!isPreview) {
            driftExports = driftExports.filter(
              (d) => !fixResult.fixedDriftKeys.has(`${d.name}:${d.issue}`),
            );
          }
        }

        spin.success('Analysis complete');

        // Handle --format output for non-text formats
        if (format !== 'text') {
          const passed = handleNonTextOutput(
            {
              format,
              openpkg,
              doccov,
              coverageScore,
              minCoverage,
              maxDrift,
              driftExports,
              typecheckErrors,
              limit: parseInt(options.limit, 10) || 20,
              stdout: options.stdout,
              outputPath: options.output,
              cwd: options.cwd,
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
            minCoverage,
            maxDrift,
            driftExports,
            typecheckErrors,
            staleRefs,
            exampleResult,
            specWarnings,
            specInfos,
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
