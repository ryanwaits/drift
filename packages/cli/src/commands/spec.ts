import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildDocCovSpec,
  DocCov,
  detectPackageManager,
  NodeFileSystem,
  renderApiSurface,
  resolveTarget,
} from '@doccov/sdk';
import { validateDocCovSpec } from '@doccov/spec';
import {
  normalize,
  type OpenPkg as OpenPkgSpec,
  type SpecGenerationInfo,
  validateSpec,
} from '@openpkg-ts/spec';
import chalk from 'chalk';
import { spinner } from 'cli-utils';
import type { Command } from 'commander';
import { type LoadedDocCovConfig, loadDocCovConfig } from '../config';
import {
  type FilterOptions as CliFilterOptions,
  mergeFilterOptions,
  parseListFlag,
  parseVisibilityFlag,
} from '../utils/filter-options';

export type SpecFormat = 'json' | 'api-surface';

export interface SpecOptions {
  // Core options
  cwd: string;
  package?: string;

  // Output
  output: string;
  format?: SpecFormat;
  openpkgOnly?: boolean;

  // Filtering
  include?: string;
  exclude?: string;
  visibility?: string;

  // Type resolution
  skipResolve?: boolean;
  maxTypeDepth?: string;

  // Schema extraction
  runtime?: boolean;

  // Caching
  cache?: boolean;

  // Diagnostics
  showDiagnostics?: boolean;

  // Verbose output
  verbose?: boolean;
}

export interface SpecCommandDependencies {
  createDocCov?: (
    options: ConstructorParameters<typeof DocCov>[0],
  ) => Pick<DocCov, 'analyzeFileWithDiagnostics'>;
  writeFileSync?: typeof fs.writeFileSync;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<SpecCommandDependencies> = {
  createDocCov: (options) => new DocCov(options),
  writeFileSync: fs.writeFileSync,
  log: console.log,
  error: console.error,
};

type GeneratedSpec = Awaited<ReturnType<DocCov['analyzeFileWithDiagnostics']>>;

function getArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function formatDiagnosticOutput(
  prefix: string,
  diagnostic: GeneratedSpec['diagnostics'][number],
  baseDir: string,
): string {
  const location = diagnostic.location;
  const relativePath = location?.file
    ? path.relative(baseDir, location.file) || location.file
    : undefined;
  const locationText =
    location && relativePath
      ? chalk.gray(`${relativePath}:${location.line ?? 1}:${location.column ?? 1}`)
      : null;
  const locationPrefix = locationText ? `${locationText} ` : '';
  return `${prefix} ${locationPrefix}${diagnostic.message}`;
}

export function registerSpecCommand(
  program: Command,
  dependencies: SpecCommandDependencies = {},
): void {
  const { createDocCov, writeFileSync, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('spec [entry]')
    .description('Generate OpenPkg + DocCov specifications')

    // === Core options ===
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('-p, --package <name>', 'Target package name (for monorepos)')

    // === Output ===
    .option('-o, --output <dir>', 'Output directory', '.doccov')
    .option('-f, --format <format>', 'Output format: json (default) or api-surface', 'json')
    .option('--openpkg-only', 'Only generate openpkg.json (skip coverage analysis)')

    // === Filtering ===
    .option('--include <patterns>', 'Include exports matching pattern (comma-separated)')
    .option('--exclude <patterns>', 'Exclude exports matching pattern (comma-separated)')
    .option(
      '--visibility <tags>',
      'Filter by release stage: public,beta,alpha,internal (comma-separated)',
    )

    // === Type resolution ===
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .option('--max-type-depth <n>', 'Maximum depth for type conversion', '20')

    // === Schema extraction ===
    .option(
      '--runtime',
      'Enable Standard Schema runtime extraction (richer output for Zod, Valibot, etc.)',
    )

    // === Caching ===
    .option('--no-cache', 'Bypass spec cache and force regeneration')

    // === Diagnostics ===
    .option('--show-diagnostics', 'Show TypeScript compiler diagnostics')

    // === Verbose ===
    .option('--verbose', 'Show detailed generation metadata')

    .action(async (entry: string | undefined, options: SpecOptions) => {
      try {
        const spin = spinner('Generating spec...');

        // Resolve target directory and entry point
        const fileSystem = new NodeFileSystem(options.cwd);
        const resolved = await resolveTarget(fileSystem, {
          cwd: options.cwd,
          package: options.package,
          entry: entry as string | undefined,
        });

        const { targetDir, entryFile } = resolved;

        // Load config
        let config: LoadedDocCovConfig | null = null;
        try {
          config = await loadDocCovConfig(targetDir);
        } catch (configError) {
          spin.fail('Failed to load config');
          error(
            chalk.red('Failed to load DocCov config:'),
            configError instanceof Error ? configError.message : configError,
          );
          process.exit(1);
        }

        // Merge filter options
        const cliFilters: CliFilterOptions = {
          include: parseListFlag(options.include),
          exclude: parseListFlag(options.exclude),
          visibility: parseVisibilityFlag(options.visibility),
        };
        const resolvedFilters = mergeFilterOptions(config, cliFilters);

        const resolveExternalTypes = !options.skipResolve;

        // Run analysis
        const doccov = createDocCov({
          resolveExternalTypes,
          maxDepth: options.maxTypeDepth ? parseInt(options.maxTypeDepth, 10) : undefined,
          useCache: options.cache !== false,
          cwd: options.cwd,
          schemaExtraction: options.runtime ? 'hybrid' : 'static',
        });

        const analyzeOptions =
          resolvedFilters.include || resolvedFilters.exclude || resolvedFilters.visibility
            ? {
                filters: {
                  include: resolvedFilters.include,
                  exclude: resolvedFilters.exclude,
                  visibility: resolvedFilters.visibility,
                },
              }
            : {};

        const result = await doccov.analyzeFileWithDiagnostics(entryFile, analyzeOptions);

        if (!result) {
          spin.fail('Generation failed');
          throw new Error('Failed to produce an OpenPkg spec.');
        }

        // Normalize and validate
        const normalized = normalize(result.spec as OpenPkgSpec);
        const validation = validateSpec(normalized);

        if (!validation.ok) {
          spin.fail('Validation failed');
          error(chalk.red('Spec failed schema validation'));
          for (const err of validation.errors) {
            error(chalk.red(`schema: ${err.instancePath || '/'} ${err.message}`));
          }
          process.exit(1);
        }

        // Build DocCov spec (unless --openpkg-only)
        let doccovSpec = null;
        if (!options.openpkgOnly) {
          doccovSpec = buildDocCovSpec({
            openpkgPath: 'openpkg.json',
            openpkg: normalized,
            packagePath: targetDir,
            forgottenExports: result.forgottenExports,
          });

          // Validate doccov spec
          const doccovValidation = validateDocCovSpec(doccovSpec);
          if (!doccovValidation.ok) {
            spin.fail('DocCov validation failed');
            error(chalk.red('DocCov spec failed schema validation'));
            for (const err of doccovValidation.errors) {
              error(chalk.red(`doccov: ${err.instancePath || '/'} ${err.message}`));
            }
            process.exit(1);
          }
        }

        // Write output based on format
        const format = options.format ?? 'json';
        const outputDir = path.resolve(options.cwd, options.output);

        // Create output directory
        fs.mkdirSync(outputDir, { recursive: true });

        if (format === 'api-surface') {
          const apiSurface = renderApiSurface(normalized);
          const apiSurfacePath = path.join(outputDir, 'api-surface.txt');
          writeFileSync(apiSurfacePath, apiSurface);
          spin.success(`Generated ${options.output}/ (API surface)`);
        } else {
          // Write openpkg.json
          const openpkgPath = path.join(outputDir, 'openpkg.json');
          writeFileSync(openpkgPath, JSON.stringify(normalized, null, 2));

          // Write doccov.json (unless --openpkg-only)
          if (doccovSpec) {
            const doccovPath = path.join(outputDir, 'doccov.json');
            writeFileSync(doccovPath, JSON.stringify(doccovSpec, null, 2));
            spin.success(`Generated ${options.output}/`);
            log(chalk.gray(`  openpkg.json: ${getArrayLength(normalized.exports)} exports`));
            log(
              chalk.gray(
                `  doccov.json:  ${doccovSpec.summary.score}% coverage, ${doccovSpec.summary.drift.total} drift issues`,
              ),
            );
          } else {
            spin.success(`Generated ${options.output}/openpkg.json`);
            log(chalk.gray(`  ${getArrayLength(normalized.exports)} exports`));
            log(chalk.gray(`  ${getArrayLength(normalized.types)} types`));
          }
        }

        // Helper to check if generation is full SpecGenerationInfo (not minimal SpecGenerationMeta)
        const isFullGenerationInfo = (
          gen: OpenPkgSpec['generation'],
        ): gen is SpecGenerationInfo => {
          return gen !== undefined && 'analysis' in gen && 'environment' in gen;
        };

        // Warn if --runtime was requested but no runtime schemas were extracted
        const fullGen = isFullGenerationInfo(normalized.generation)
          ? normalized.generation
          : undefined;
        const schemaExtraction = fullGen?.analysis?.schemaExtraction;
        if (
          options.runtime &&
          (!schemaExtraction?.runtimeCount || schemaExtraction.runtimeCount === 0)
        ) {
          const pm = await detectPackageManager(fileSystem);
          const buildCmd = pm.name === 'npm' ? 'npm run build' : `${pm.name} run build`;
          log('');
          log(chalk.yellow('⚠ Runtime extraction requested but no schemas extracted.'));
          log(chalk.yellow(`  Ensure project is built (${buildCmd}) and dist/ exists.`));
        }

        // Show verbose generation metadata if requested
        if (options.verbose && fullGen) {
          log('');
          log(chalk.bold('Generation Info'));
          log(chalk.gray(`  Timestamp:        ${fullGen.timestamp}`));
          log(
            chalk.gray(
              `  Generator:        ${fullGen.generator.name}@${fullGen.generator.version}`,
            ),
          );
          log(chalk.gray(`  Entry point:      ${fullGen.analysis.entryPoint}`));
          log(chalk.gray(`  Detected via:     ${fullGen.analysis.entryPointSource}`));
          log(
            chalk.gray(`  Declaration only: ${fullGen.analysis.isDeclarationOnly ? 'yes' : 'no'}`),
          );
          log(
            chalk.gray(
              `  External types:   ${fullGen.analysis.resolvedExternalTypes ? 'resolved' : 'skipped'}`,
            ),
          );
          if (fullGen.analysis.maxTypeDepth) {
            log(chalk.gray(`  Max type depth:   ${fullGen.analysis.maxTypeDepth}`));
          }
          if (fullGen.analysis.schemaExtraction) {
            const se = fullGen.analysis.schemaExtraction;
            log(chalk.gray(`  Schema extraction: ${se.method}`));
            if (se.runtimeCount) {
              log(
                chalk.gray(`  Runtime schemas:   ${se.runtimeCount} (${se.vendors?.join(', ')})`),
              );
            }
          }
          log('');
          log(chalk.bold('Environment'));
          log(
            chalk.gray(
              `  node_modules:     ${fullGen.environment.hasNodeModules ? 'found' : 'not found'}`,
            ),
          );
          if (fullGen.environment.packageManager) {
            log(chalk.gray(`  Package manager:  ${fullGen.environment.packageManager}`));
          }
          if (fullGen.environment.isMonorepo) {
            log(chalk.gray(`  Monorepo:         yes`));
          }
          if (fullGen.environment.targetPackage) {
            log(chalk.gray(`  Target package:   ${fullGen.environment.targetPackage}`));
          }

          if (fullGen.issues.length > 0) {
            log('');
            log(chalk.bold('Issues'));
            for (const issue of fullGen.issues) {
              const prefix =
                issue.severity === 'error'
                  ? chalk.red('>')
                  : issue.severity === 'warning'
                    ? chalk.yellow('>')
                    : chalk.cyan('>');
              log(`${prefix} [${issue.code}] ${issue.message}`);
              if (issue.suggestion) {
                log(chalk.gray(`    ${issue.suggestion}`));
              }
            }
          }
        }

        // Show diagnostics if requested
        if (options.showDiagnostics && result.diagnostics.length > 0) {
          log('');
          log(chalk.bold('Diagnostics'));
          for (const diagnostic of result.diagnostics) {
            const prefix =
              diagnostic.severity === 'error'
                ? chalk.red('>')
                : diagnostic.severity === 'warning'
                  ? chalk.yellow('>')
                  : chalk.cyan('>');
            log(formatDiagnosticOutput(prefix, diagnostic, targetDir));
          }
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
