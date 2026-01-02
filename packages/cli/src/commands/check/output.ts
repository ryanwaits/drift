import { colors, summary as createSummary, getSymbols, supportsUnicode } from 'cli-utils';
import type { Diagnostic, ExampleTypeError, ExampleValidationResult } from '@doccov/sdk';
import { generateReportFromDocCov } from '@doccov/sdk';
import type { DocCovSpec } from '@doccov/spec';
import type { OpenPkg } from '@openpkg-ts/spec';
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

  const sym = getSymbols(supportsUnicode());

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
      log(colors.warning(`${sym.warning} ${diag.message}`));
      if (diag.suggestion) {
        log(colors.muted(`  ${diag.suggestion}`));
      }
    }
    for (const diag of specInfos) {
      log(colors.info(`${sym.info} ${diag.message}`));
      if (diag.suggestion) {
        log(colors.muted(`  ${diag.suggestion}`));
      }
    }
  }

  // Render concise summary output using Summary component
  const pkgName = openpkg.meta?.name ?? 'unknown';
  const pkgVersion = openpkg.meta?.version ?? '';
  const totalExports = openpkg.exports?.length ?? 0;

  log('');
  log(colors.bold(`${pkgName}${pkgVersion ? `@${pkgVersion}` : ''}`));
  log('');

  // Build summary with key metrics
  const summaryBuilder = createSummary({ keyWidth: 10 });

  summaryBuilder.addKeyValue('Exports', totalExports);
  summaryBuilder.addKeyValue('Coverage', `${coverageScore}%`, coverageFailed ? 'fail' : 'pass');

  if (maxDrift !== undefined) {
    summaryBuilder.addKeyValue('Drift', `${driftScore}%`, driftFailed ? 'fail' : 'pass');
  } else {
    summaryBuilder.addKeyValue('Drift', `${driftScore}%`);
  }

  // Show example validation status
  if (exampleResult) {
    const typecheckCount = exampleResult.typecheck?.errors.length ?? 0;
    if (typecheckCount > 0) {
      summaryBuilder.addKeyValue('Examples', `${typecheckCount} type error(s)`, 'warn');
    } else {
      summaryBuilder.addKeyValue('Examples', 'validated', 'pass');
    }
  }

  // Show stale docs status
  const hasStaleRefs = staleRefs.length > 0;
  if (hasStaleRefs) {
    summaryBuilder.addKeyValue('Docs', `${staleRefs.length} stale ref(s)`, 'warn');
  }

  summaryBuilder.print();

  // Show details for errors
  if (hasTypecheckErrors) {
    log('');
    for (const err of typecheckErrors.slice(0, 5)) {
      const loc = `example[${err.error.exampleIndex}]:${err.error.line}:${err.error.column}`;
      log(colors.muted(`  ${err.exportName} ${loc}`));
      log(colors.error(`    ${err.error.message}`));
    }
    if (typecheckErrors.length > 5) {
      log(colors.muted(`  ... and ${typecheckErrors.length - 5} more`));
    }
  }

  if (hasStaleRefs) {
    log('');
    for (const ref of staleRefs.slice(0, 5)) {
      log(colors.muted(`  ${ref.file}:${ref.line} - "${ref.exportName}"`));
    }
    if (staleRefs.length > 5) {
      log(colors.muted(`  ... and ${staleRefs.length - 5} more`));
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

    log(colors.success(`${sym.success} Check passed (${thresholdParts.join(', ')})`));
    return true; // passed
  }

  // Show failure reasons
  if (coverageFailed) {
    log(colors.error(`${sym.error} Coverage ${coverageScore}% below minimum ${minCoverage}%`));
  }
  if (driftFailed) {
    log(colors.error(`${sym.error} Drift ${driftScore}% exceeds maximum ${maxDrift}%`));
  }
  if (hasTypecheckErrors) {
    log(colors.error(`${sym.error} ${typecheckErrors.length} example type errors`));
  }
  if (hasStaleRefs) {
    log(colors.error(`${sym.error} ${staleRefs.length} stale references in docs`));
  }

  log('');
  log(colors.muted('Use --format json or --format markdown for detailed reports'));

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
