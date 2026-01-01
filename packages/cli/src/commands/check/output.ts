import type { Diagnostic, ExampleTypeError, ExampleValidationResult } from '@doccov/sdk';
import { generateReportFromDocCov } from '@doccov/sdk';
import type { DocCovSpec } from '@doccov/spec';
import type { OpenPkg } from '@openpkg-ts/spec';
import chalk from 'chalk';
import {
  computeStats,
  renderGithubSummary,
  renderHtml,
  renderMarkdown,
  writeReports,
} from '../../reports';
import type { CollectedDrift, OutputFormat, StaleReference } from './types';

export interface TextOutputOptions {
  openpkg: OpenPkg;
  doccov: DocCovSpec;
  coverageScore: number;
  minCoverage: number;
  maxDrift: number | undefined;
  driftExports: CollectedDrift[];
  typecheckErrors: Array<{ exportName: string; error: ExampleTypeError }>;
  staleRefs: StaleReference[];
  exampleResult: ExampleValidationResult | undefined;
  specWarnings: Diagnostic[];
  specInfos: Diagnostic[];
}

export interface TextOutputDeps {
  log: typeof console.log;
}

/**
 * Display text summary output
 */
export function displayTextOutput(options: TextOutputOptions, deps: TextOutputDeps): boolean {
  const {
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
  } = options;
  const { log } = deps;

  // Calculate drift percentage
  const totalExportsForDrift = openpkg.exports?.length ?? 0;
  const exportsWithDrift = new Set(driftExports.map((d) => d.name)).size;
  const driftScore =
    totalExportsForDrift === 0 ? 0 : Math.round((exportsWithDrift / totalExportsForDrift) * 100);

  const coverageFailed = coverageScore < minCoverage;
  const driftFailed = maxDrift !== undefined && driftScore > maxDrift;
  const hasTypecheckErrors = typecheckErrors.length > 0;

  // Display spec diagnostics (warnings/info)
  if (specWarnings.length > 0 || specInfos.length > 0) {
    log('');
    for (const diag of specWarnings) {
      log(chalk.yellow(`⚠ ${diag.message}`));
      if (diag.suggestion) {
        log(chalk.gray(`  ${diag.suggestion}`));
      }
    }
    for (const diag of specInfos) {
      log(chalk.cyan(`ℹ ${diag.message}`));
      if (diag.suggestion) {
        log(chalk.gray(`  ${diag.suggestion}`));
      }
    }
  }

  // Render concise summary output
  const pkgName = openpkg.meta?.name ?? 'unknown';
  const pkgVersion = openpkg.meta?.version ?? '';
  const totalExports = openpkg.exports?.length ?? 0;

  log('');
  log(chalk.bold(`${pkgName}${pkgVersion ? `@${pkgVersion}` : ''}`));
  log('');
  log(`  Exports:    ${totalExports}`);

  // Coverage with pass/fail indicator
  if (coverageFailed) {
    log(chalk.red(`  Coverage:   ✗ ${coverageScore}%`) + chalk.dim(` (min ${minCoverage}%)`));
  } else {
    log(chalk.green(`  Coverage:   ✓ ${coverageScore}%`) + chalk.dim(` (min ${minCoverage}%)`));
  }

  // Drift with pass/fail indicator when threshold is set
  if (maxDrift !== undefined) {
    if (driftFailed) {
      log(chalk.red(`  Drift:      ✗ ${driftScore}%`) + chalk.dim(` (max ${maxDrift}%)`));
    } else {
      log(chalk.green(`  Drift:      ✓ ${driftScore}%`) + chalk.dim(` (max ${maxDrift}%)`));
    }
  } else {
    log(`  Drift:      ${driftScore}%`);
  }

  // Show example validation results (typecheck errors only - runtime errors are in Drift)
  if (exampleResult) {
    const typecheckCount = exampleResult.typecheck?.errors.length ?? 0;
    if (typecheckCount > 0) {
      log(chalk.yellow(`  Examples:   ${typecheckCount} type error(s)`));
      // Show first few errors with details
      for (const err of typecheckErrors.slice(0, 5)) {
        const loc = `example[${err.error.exampleIndex}]:${err.error.line}:${err.error.column}`;
        log(chalk.dim(`              ${err.exportName} ${loc}`));
        log(chalk.red(`                ${err.error.message}`));
      }
      if (typecheckErrors.length > 5) {
        log(chalk.dim(`              ... and ${typecheckErrors.length - 5} more`));
      }
    } else {
      log(chalk.green(`  Examples:   ✓ validated`));
    }
  }

  // Show stale docs references
  const hasStaleRefs = staleRefs.length > 0;
  if (hasStaleRefs) {
    log(chalk.yellow(`  Docs:       ${staleRefs.length} stale ref(s)`));
    for (const ref of staleRefs.slice(0, 5)) {
      log(chalk.dim(`              ${ref.file}:${ref.line} - "${ref.exportName}"`));
    }
    if (staleRefs.length > 5) {
      log(chalk.dim(`              ... and ${staleRefs.length - 5} more`));
    }
  }

  log('');

  // Show pass/fail status
  const failed = coverageFailed || driftFailed || hasTypecheckErrors || hasStaleRefs;

  if (!failed) {
    const thresholdParts: string[] = [];
    thresholdParts.push(`coverage ${coverageScore}% ≥ ${minCoverage}%`);
    if (maxDrift !== undefined) {
      thresholdParts.push(`drift ${driftScore}% ≤ ${maxDrift}%`);
    }

    log(chalk.green(`✓ Check passed (${thresholdParts.join(', ')})`));
    return true; // passed
  }

  // Show failure reasons
  if (hasTypecheckErrors) {
    log(chalk.red(`✗ ${typecheckErrors.length} example type errors`));
  }
  if (hasStaleRefs) {
    log(chalk.red(`✗ ${staleRefs.length} stale references in docs`));
  }

  log('');
  log(chalk.dim('Use --format json or --format markdown for detailed reports'));

  return false; // failed
}

export interface NonTextOutputOptions {
  format: OutputFormat;
  openpkg: OpenPkg;
  doccov: DocCovSpec;
  coverageScore: number;
  minCoverage: number;
  maxDrift: number | undefined;
  driftExports: CollectedDrift[];
  typecheckErrors: Array<{ exportName: string; error: ExampleTypeError }>;
  limit: number;
  stdout: boolean;
  outputPath?: string;
  cwd: string;
}

export interface NonTextOutputDeps {
  log: typeof console.log;
}

/**
 * Handle non-text format output (json, markdown, html, github)
 * Returns true if passed thresholds, false if failed
 */
export function handleNonTextOutput(
  options: NonTextOutputOptions,
  deps: NonTextOutputDeps,
): boolean {
  const {
    format,
    openpkg,
    doccov,
    coverageScore,
    minCoverage,
    maxDrift,
    driftExports,
    typecheckErrors,
    limit,
    stdout,
    outputPath,
    cwd,
  } = options;
  const { log } = deps;

  const stats = computeStats(openpkg, doccov);

  // Generate JSON report (always needed for cache)
  const report = generateReportFromDocCov(openpkg, doccov);
  const jsonContent = JSON.stringify(report, null, 2);

  // Generate requested format content
  let formatContent: string;
  switch (format) {
    case 'json':
      formatContent = jsonContent;
      break;
    case 'markdown':
      formatContent = renderMarkdown(stats, { limit });
      break;
    case 'html':
      formatContent = renderHtml(stats, { limit });
      break;
    case 'github':
      formatContent = renderGithubSummary(stats, {
        coverageScore,
        driftCount: driftExports.length,
      });
      break;
    default:
      throw new Error(`Unknown format: ${format}`);
  }

  // Write reports to .doccov/ (or output to stdout with --stdout)
  if (stdout) {
    log(formatContent);
  } else {
    writeReports({
      format,
      formatContent,
      jsonContent,
      outputPath,
      cwd,
    });
  }

  // Calculate drift percentage
  const totalExportsForDrift = openpkg.exports?.length ?? 0;
  const exportsWithDrift = new Set(driftExports.map((d) => d.name)).size;
  const driftScore =
    totalExportsForDrift === 0 ? 0 : Math.round((exportsWithDrift / totalExportsForDrift) * 100);

  // Check thresholds
  const coverageFailed = coverageScore < minCoverage;
  const driftFailed = maxDrift !== undefined && driftScore > maxDrift;
  const hasTypecheckErrors = typecheckErrors.length > 0;

  return !(coverageFailed || driftFailed || hasTypecheckErrors);
}
