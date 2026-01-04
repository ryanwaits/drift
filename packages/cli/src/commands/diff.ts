import * as fs from 'node:fs';
import * as path from 'node:path';
import { spinner } from 'cli-utils';
import {
  diffSpecWithDocs,
  ensureSpecCoverage,
  getDiffReportPath,
  getDocsImpactSummary,
  hasDocsImpact,
  hashString,
  type MarkdownDocFile,
  parseMarkdownFiles,
  type SpecDiffWithDocs,
} from '@doccov/sdk';
import { calculateNextVersion, type OpenPkg, recommendSemverBump } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import { glob } from 'glob';
import { loadDocCovConfig } from '../config';
import {
  type DiffReportData,
  renderChangelog,
  renderDiffHtml,
  renderDiffMarkdown,
  renderPRComment,
  writeReport,
} from '../reports';
import { resolveThreshold } from '../utils/validation';

export interface DiffCommandDependencies {
  readFileSync?: typeof fs.readFileSync;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<DiffCommandDependencies> = {
  readFileSync: fs.readFileSync,
  log: console.log,
  error: console.error,
};

type OutputFormat = 'text' | 'json' | 'markdown' | 'html' | 'github' | 'pr-comment' | 'changelog';

/** Strict mode presets */
type StrictPreset = 'ci' | 'release' | 'quality';

const STRICT_PRESETS: Record<StrictPreset, Set<string>> = {
  ci: new Set(['breaking', 'regression']),
  release: new Set(['breaking', 'regression', 'drift', 'docs-impact', 'undocumented']),
  quality: new Set(['drift', 'undocumented']),
};

/**
 * Get strict checks from preset name
 */
function getStrictChecks(preset: string | undefined): Set<string> {
  if (!preset) return new Set();
  const checks = STRICT_PRESETS[preset as StrictPreset];
  if (!checks) {
    throw new Error(`Unknown --strict preset: ${preset}. Valid: ci, release, quality`);
  }
  return checks;
}

export function registerDiffCommand(
  program: Command,
  dependencies: DiffCommandDependencies = {},
): void {
  const { readFileSync, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('diff [base] [head]')
    .description('Compare two OpenPkg specs and detect breaking changes')
    // Explicit spec arguments (alternative to positional)
    .option('--base <file>', 'Base spec file (the "before" state)')
    .option('--head <file>', 'Head spec file (the "after" state)')
    // Output control
    .option(
      '--format <format>',
      'Output format: text, json, markdown, html, github, pr-comment, changelog',
      'text',
    )
    .option('--stdout', 'Output to stdout instead of writing to .doccov/')
    .option('-o, --output <file>', 'Custom output path')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--limit <n>', 'Max items to show in terminal/reports', '10')
    // PR comment options
    .option('--repo-url <url>', 'GitHub repo URL for file links (pr-comment format)')
    .option('--sha <sha>', 'Commit SHA for file links (pr-comment format)')
    // Thresholds (same as check command, applied to HEAD spec)
    .option('--min-coverage <n>', 'Minimum coverage % for HEAD spec (0-100)')
    .option('--max-drift <n>', 'Maximum drift % for HEAD spec (0-100)')
    // Strict mode presets (for diff-specific checks like regressions)
    .option('--strict <preset>', 'Fail on conditions: ci, release, quality')
    // Docs analysis
    .option('--docs <glob>', 'Glob pattern for markdown docs to check for impact', collect, [])
    // Caching
    .option('--no-cache', 'Bypass cache and force regeneration')
    // Semver recommendation
    .option('--recommend-version', 'Output recommended semver version bump')
    .action(async (baseArg: string | undefined, headArg: string | undefined, options) => {
      try {
        // Support both positional and explicit arguments
        const baseFile = options.base ?? baseArg;
        const headFile = options.head ?? headArg;

        if (!baseFile || !headFile) {
          throw new Error(
            'Both base and head specs are required.\n' +
              'Usage: doccov diff <base> <head>\n' +
              '   or: doccov diff --base main.json --head feature.json',
          );
        }

        const spin = spinner('Comparing specs...');

        const baseSpec = loadSpec(baseFile, readFileSync);
        const headSpec = loadSpec(headFile, readFileSync);

        // Load config (needed for docs patterns and thresholds)
        const config = await loadDocCovConfig(options.cwd);

        // Generate hash for report naming/caching
        const baseHash = hashString(JSON.stringify(baseSpec));
        const headHash = hashString(JSON.stringify(headSpec));
        const cacheEnabled = options.cache !== false;

        // Check for cached report
        const cachedReportPath = path.resolve(
          options.cwd,
          getDiffReportPath(baseHash, headHash, 'json'),
        );
        let diff: SpecDiffWithDocs;
        let fromCache = false;

        if (cacheEnabled && fs.existsSync(cachedReportPath)) {
          // Use cached report
          try {
            const cached = JSON.parse(fs.readFileSync(cachedReportPath, 'utf-8'));
            diff = cached as SpecDiffWithDocs;
            fromCache = true;
          } catch {
            // Cache corrupted, regenerate
            diff = await generateDiff(baseSpec, headSpec, options, config, log);
          }
        } else {
          // Generate fresh diff
          diff = await generateDiff(baseSpec, headSpec, options, config, log);
        }

        // Resolve thresholds (CLI flags take precedence over config)
        const minCoverage = resolveThreshold(options.minCoverage, config?.check?.minCoverage);
        const maxDrift = resolveThreshold(options.maxDrift, config?.check?.maxDrift);

        // Handle --recommend-version flag
        if (options.recommendVersion) {
          spin.success('Comparison complete');
          const recommendation = recommendSemverBump(diff);
          const currentVersion = headSpec.meta?.version ?? '0.0.0';
          const nextVersion = calculateNextVersion(currentVersion, recommendation.bump);

          if (options.format === 'json') {
            log(
              JSON.stringify(
                {
                  current: currentVersion,
                  recommended: nextVersion,
                  bump: recommendation.bump,
                  reason: recommendation.reason,
                  breakingCount: recommendation.breakingCount,
                  additionCount: recommendation.additionCount,
                  docsOnlyChanges: recommendation.docsOnlyChanges,
                },
                null,
                2,
              ),
            );
          } else {
            log('');
            log(chalk.bold('Semver Recommendation'));
            log(`  Current version:    ${currentVersion}`);
            log(
              `  Recommended:        ${chalk.cyan(nextVersion)} (${chalk.yellow(recommendation.bump.toUpperCase())})`,
            );
            log(`  Reason:             ${recommendation.reason}`);
          }
          return;
        }

        // Handle format
        const format = (options.format ?? 'text') as OutputFormat;
        const limit = parseInt(options.limit, 10) || 10;

        // Parse strict preset
        const checks = getStrictChecks(options.strict);

        // Prepare report data
        const baseName = path.basename(baseFile);
        const headName = path.basename(headFile);
        const reportData: DiffReportData = {
          baseName,
          headName,
          ...diff,
        };

        spin.success('Comparison complete');

        // Output based on format
        switch (format) {
          case 'text':
            printSummary(diff, baseName, headName, fromCache, log);

            // Write JSON for caching (unless --stdout or already from cache)
            if (!options.stdout) {
              const jsonPath = getDiffReportPath(baseHash, headHash, 'json');
              if (!fromCache) {
                writeReport({
                  format: 'json',
                  content: JSON.stringify(diff, null, 2),
                  cwd: options.cwd,
                  outputPath: jsonPath,
                  silent: true,
                });
              }
              const cacheNote = fromCache ? chalk.cyan(' (cached)') : '';
              log(chalk.dim(`Report: ${jsonPath}`) + cacheNote);
            }
            break;

          case 'json': {
            const content = JSON.stringify(diff, null, 2);
            if (options.stdout) {
              log(content);
            } else {
              const outputPath = options.output ?? getDiffReportPath(baseHash, headHash, 'json');
              writeReport({
                format: 'json',
                content,
                outputPath,
                cwd: options.cwd,
              });
            }
            break;
          }

          case 'markdown': {
            const content = renderDiffMarkdown(reportData, { limit });
            if (options.stdout) {
              log(content);
            } else {
              const outputPath =
                options.output ?? getDiffReportPath(baseHash, headHash, 'markdown');
              writeReport({
                format: 'markdown',
                content,
                outputPath,
                cwd: options.cwd,
              });
            }
            break;
          }

          case 'html': {
            const content = renderDiffHtml(reportData, { limit });
            if (options.stdout) {
              log(content);
            } else {
              const outputPath = options.output ?? getDiffReportPath(baseHash, headHash, 'html');
              writeReport({
                format: 'html',
                content,
                outputPath,
                cwd: options.cwd,
              });
            }
            break;
          }

          case 'github':
            // Always stdout for CI annotation parsing
            printGitHubAnnotations(diff, log);
            break;

          case 'pr-comment': {
            // PR comment format - always stdout for GitHub Actions
            const semverRecommendation = recommendSemverBump(diff);
            const content = renderPRComment(
              { diff, baseName, headName, headSpec },
              {
                repoUrl: options.repoUrl,
                sha: options.sha,
                minCoverage,
                limit,
                semverBump: {
                  bump: semverRecommendation.bump,
                  reason: semverRecommendation.reason,
                },
              },
            );
            log(content);
            break;
          }

          case 'changelog': {
            // Changelog format
            const content = renderChangelog(
              {
                diff,
                categorizedBreaking: diff.categorizedBreaking,
                version: headSpec.meta?.version,
              },
              {
                version: headSpec.meta?.version,
                compareUrl: options.repoUrl
                  ? `${options.repoUrl}/compare/${baseSpec.meta?.version ?? 'v0'}...${headSpec.meta?.version ?? 'HEAD'}`
                  : undefined,
              },
            );
            if (options.stdout) {
              log(content);
            } else {
              const outputPath = options.output ?? getDiffReportPath(baseHash, headHash, 'md');
              writeReport({
                format: 'markdown',
                content,
                outputPath: outputPath.replace(/\.(json|html)$/, '.changelog.md'),
                cwd: options.cwd,
              });
            }
            break;
          }
        }

        // Run validation (thresholds + strict presets)
        const failures = validateDiff(diff, headSpec, {
          minCoverage,
          maxDrift,
          checks,
        });

        // Output result
        if (failures.length > 0) {
          log(chalk.red('\n\u2717 Check failed'));
          for (const f of failures) {
            log(chalk.red(`  - ${f}`));
          }
          process.exitCode = 1;
        } else if (options.strict || minCoverage !== undefined || maxDrift !== undefined) {
          // Only show "passed" if thresholds or strict mode were configured
          log(chalk.green('\n\u2713 All checks passed'));
        }
        // No thresholds/strict = informational only, exit 0 (no pass/fail message)
      } catch (commandError) {
        error(
          chalk.red('Error:'),
          commandError instanceof Error ? commandError.message : commandError,
        );
        process.exitCode = 1;
      }
    });
}

/**
 * Collect multiple option values into an array
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Load markdown files from glob patterns
 */
async function loadMarkdownFiles(patterns: string[]): Promise<MarkdownDocFile[]> {
  const files: Array<{ path: string; content: string }> = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern, { nodir: true });
    for (const filePath of matches) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        files.push({ path: filePath, content });
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return parseMarkdownFiles(files);
}

interface GenerateDiffOptions {
  docs?: string[];
  cwd: string;
}

/**
 * Generate a fresh diff between two specs
 */
async function generateDiff(
  baseSpec: OpenPkg,
  headSpec: OpenPkg,
  options: GenerateDiffOptions,
  config: Awaited<ReturnType<typeof loadDocCovConfig>>,
  log: typeof console.log,
): Promise<SpecDiffWithDocs> {
  // Load markdown files if --docs specified or from config
  let markdownFiles: MarkdownDocFile[] | undefined;
  let docsPatterns = options.docs as string[] | undefined;

  // If no --docs flag, try to load from config
  if (!docsPatterns || docsPatterns.length === 0) {
    if (config?.docs?.include) {
      docsPatterns = config.docs.include;
      log(chalk.gray(`Using docs patterns from config: ${docsPatterns.join(', ')}`));
    }
  }

  if (docsPatterns && docsPatterns.length > 0) {
    markdownFiles = await loadMarkdownFiles(docsPatterns);
  }

  return diffSpecWithDocs(baseSpec, headSpec, { markdownFiles });
}

function loadSpec(filePath: string, readFileSync: typeof fs.readFileSync): OpenPkg {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  try {
    const content = readFileSync(resolvedPath, 'utf-8');
    const spec = JSON.parse(content) as OpenPkg;
    // Ensure coverage score is present for diffing (uses SDK shared utility)
    return ensureSpecCoverage(spec) as OpenPkg;
  } catch (parseError) {
    throw new Error(
      `Failed to parse ${filePath}: ${parseError instanceof Error ? parseError.message : parseError}`,
    );
  }
}

/**
 * Print simplified terminal summary
 */
function printSummary(
  diff: SpecDiffWithDocs,
  baseName: string,
  headName: string,
  fromCache: boolean,
  log: typeof console.log,
): void {
  log('');
  const cacheIndicator = fromCache ? chalk.cyan(' (cached)') : '';
  log(chalk.bold(`Comparing: ${baseName} → ${headName}`) + cacheIndicator);
  log('─'.repeat(40));
  log('');

  // Coverage
  const coverageColor =
    diff.coverageDelta > 0 ? chalk.green : diff.coverageDelta < 0 ? chalk.red : chalk.gray;
  const coverageSign = diff.coverageDelta > 0 ? '+' : '';
  log(
    `  Coverage:   ${diff.oldCoverage}% \u2192 ${diff.newCoverage}% ${coverageColor(`(${coverageSign}${diff.coverageDelta}%)`)}`,
  );

  // Breaking changes
  const breakingCount = diff.breaking.length;
  const highSeverity = diff.categorizedBreaking?.filter((c) => c.severity === 'high').length ?? 0;
  if (breakingCount > 0) {
    const severityNote = highSeverity > 0 ? chalk.red(` (${highSeverity} high severity)`) : '';
    log(`  Breaking:   ${chalk.red(breakingCount)} changes${severityNote}`);
  } else {
    log(`  Breaking:   ${chalk.green('0')} changes`);
  }

  // New exports
  const newCount = diff.nonBreaking.length;
  const undocCount = diff.newUndocumented.length;
  if (newCount > 0) {
    const undocNote = undocCount > 0 ? chalk.yellow(` (${undocCount} undocumented)`) : '';
    log(`  New:        ${chalk.green(newCount)} exports${undocNote}`);
  }

  // Drift
  if (diff.driftIntroduced > 0 || diff.driftResolved > 0) {
    const parts: string[] = [];
    if (diff.driftIntroduced > 0) parts.push(chalk.red(`+${diff.driftIntroduced}`));
    if (diff.driftResolved > 0) parts.push(chalk.green(`-${diff.driftResolved}`));
    log(`  Drift:      ${parts.join(', ')}`);
  }

  // Semver recommendation hint
  const recommendation = recommendSemverBump(diff);
  const bumpColor =
    recommendation.bump === 'major'
      ? chalk.red
      : recommendation.bump === 'minor'
        ? chalk.yellow
        : chalk.green;
  log(`  Semver:     ${bumpColor(recommendation.bump.toUpperCase())} (${recommendation.reason})`);

  log('');
}

interface ValidationOptions {
  minCoverage?: number;
  maxDrift?: number;
  checks: Set<string>;
}

/**
 * Validate diff against thresholds and strict presets
 * Returns array of failure messages (empty if all pass)
 */
function validateDiff(
  diff: SpecDiffWithDocs,
  headSpec: OpenPkg,
  options: ValidationOptions,
): string[] {
  const { minCoverage, maxDrift, checks } = options;
  const failures: string[] = [];

  // === Threshold validation (applied to HEAD spec) ===
  // Calculate HEAD spec's drift score
  type EnrichedExport = { docs?: { drift?: unknown[] }; name: string };
  const headExportsWithDrift = new Set(
    (headSpec.exports ?? [])
      .filter((e) => (e as EnrichedExport).docs?.drift?.length)
      .map((e) => e.name),
  ).size;
  const headDriftScore = headSpec.exports?.length
    ? Math.round((headExportsWithDrift / headSpec.exports.length) * 100)
    : 0;

  if (minCoverage !== undefined && diff.newCoverage < minCoverage) {
    failures.push(`Coverage ${diff.newCoverage}% below minimum ${minCoverage}%`);
  }

  if (maxDrift !== undefined && headDriftScore > maxDrift) {
    failures.push(`Drift ${headDriftScore}% exceeds maximum ${maxDrift}%`);
  }

  // === Strict preset validation (diff-specific) ===
  if (checks.has('regression') && diff.coverageDelta < 0) {
    failures.push(`Coverage regressed by ${Math.abs(diff.coverageDelta)}%`);
  }

  if (checks.has('breaking') && diff.breaking.length > 0) {
    failures.push(`${diff.breaking.length} breaking change(s)`);
  }

  if (checks.has('drift') && diff.driftIntroduced > 0) {
    failures.push(`${diff.driftIntroduced} new drift issue(s)`);
  }

  if (checks.has('undocumented') && diff.newUndocumented.length > 0) {
    failures.push(`${diff.newUndocumented.length} undocumented export(s)`);
  }

  if (checks.has('docs-impact') && hasDocsImpact(diff)) {
    const summary = getDocsImpactSummary(diff);
    failures.push(`${summary.totalIssues} docs issue(s)`);
  }

  return failures;
}

/**
 * Print GitHub Actions annotations format
 */
function printGitHubAnnotations(diff: SpecDiffWithDocs, log: typeof console.log): void {
  // Coverage change annotation
  if (diff.coverageDelta !== 0) {
    const level = diff.coverageDelta < 0 ? 'warning' : 'notice';
    const sign = diff.coverageDelta > 0 ? '+' : '';
    log(
      `::${level} title=Coverage Change::Coverage ${diff.oldCoverage}% \u2192 ${diff.newCoverage}% (${sign}${diff.coverageDelta}%)`,
    );
  }

  // Breaking changes
  for (const breaking of diff.categorizedBreaking ?? []) {
    const level = breaking.severity === 'high' ? 'error' : 'warning';
    log(`::${level} title=Breaking Change::${breaking.name} - ${breaking.reason}`);
  }

  // Member-level changes (method removals, signature changes)
  for (const mc of diff.memberChanges ?? []) {
    if (mc.changeType === 'removed') {
      const suggestion = mc.suggestion ? ` ${mc.suggestion}` : '';
      log(
        `::warning title=Method Removed::${mc.className}.${mc.memberName}() removed.${suggestion}`,
      );
    } else if (mc.changeType === 'signature-changed') {
      log(
        `::warning title=Signature Changed::${mc.className}.${mc.memberName}() signature changed`,
      );
    }
  }

  // Docs impact annotations (with file and line info)
  if (diff.docsImpact) {
    for (const file of diff.docsImpact.impactedFiles) {
      for (const ref of file.references) {
        const level =
          ref.changeType === 'removed' || ref.changeType === 'method-removed' ? 'error' : 'warning';
        const name = ref.memberName ? `${ref.memberName}()` : ref.exportName;
        const changeDesc =
          ref.changeType === 'removed' || ref.changeType === 'method-removed'
            ? 'removed'
            : ref.changeType === 'signature-changed' || ref.changeType === 'method-changed'
              ? 'signature changed'
              : 'changed';
        const suggestion = ref.replacementSuggestion ? ` \u2192 ${ref.replacementSuggestion}` : '';

        log(
          `::${level} file=${file.file},line=${ref.line},title=API Change::${name} ${changeDesc}${suggestion}`,
        );
      }
    }

    // Missing docs annotations (new exports only)
    for (const name of diff.docsImpact.missingDocs) {
      log(`::notice title=Missing Documentation::New export ${name} needs documentation`);
    }

    // Summary annotation for total documentation coverage
    const { stats, allUndocumented } = diff.docsImpact;
    if (allUndocumented && allUndocumented.length > 0) {
      const docPercent = Math.round((1 - allUndocumented.length / stats.totalExports) * 100);
      log(
        `::notice title=Documentation Coverage::${stats.documentedExports}/${stats.totalExports} exports documented (${docPercent}%)`,
      );
    }
  }

  // New undocumented exports (not covered by docsImpact)
  if (!diff.docsImpact && diff.newUndocumented.length > 0) {
    for (const name of diff.newUndocumented) {
      log(`::notice title=Missing Documentation::New export ${name} needs documentation`);
    }
  }

  // Drift issues
  if (diff.driftIntroduced > 0) {
    log(`::warning title=Drift Detected::${diff.driftIntroduced} new drift issue(s) introduced`);
  }
}
