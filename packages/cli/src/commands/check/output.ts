import type { Diagnostic, ExampleTypeError, ExampleValidationResult } from '@doccov/sdk';
import { generateReportFromDocCov } from '@doccov/sdk';
import type { DocCovSpec } from '@doccov/spec';
import type { OpenPkg } from '@openpkg-ts/spec';
import { colors, summary as createSummary, getSymbols, supportsUnicode } from 'cli-utils';
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
  minHealth: number;
  minApiSurface: number | undefined;
  warnBelowApiSurface: number | undefined;
  driftExports: CollectedDrift[];
  typecheckErrors: Array<{ exportName: string; error: ExampleTypeError }>;
  staleRefs: StaleReference[];
  exampleResult: ExampleValidationResult | undefined;
  specWarnings: Diagnostic[];
  specInfos: Diagnostic[];
  verbose: boolean;
}

export interface TextOutputDeps {
  log: typeof console.log;
}

/**
 * Get color status for health score (green 80+, yellow 60-79, red <60)
 */
function getHealthStatus(score: number): 'pass' | 'warn' | 'fail' {
  if (score >= 80) return 'pass';
  if (score >= 60) return 'warn';
  return 'fail';
}

/**
 * Get color function for health status
 */
function getHealthColor(status: 'pass' | 'warn' | 'fail'): (s: string) => string {
  switch (status) {
    case 'pass':
      return colors.success;
    case 'warn':
      return colors.warning;
    case 'fail':
      return colors.error;
  }
}

/**
 * Display health tree view with completeness/accuracy breakdown
 */
function displayHealthTree(
  health: import('@doccov/spec').DocumentationHealth,
  log: typeof console.log,
): void {
  const tree = supportsUnicode()
    ? { branch: '├─', corner: '└─' }
    : { branch: '|-', corner: '\\-' };

  // Completeness line
  const missingTotal = Object.values(health.completeness.missing).reduce((a, b) => a + b, 0);
  const completenessLabel = missingTotal > 0
    ? `${health.completeness.score}%  (${missingTotal} missing docs)`
    : `${health.completeness.score}%`;
  const completenessColor = getHealthColor(getHealthStatus(health.completeness.score));
  log(`${tree.branch} ${colors.muted('completeness')}  ${completenessColor(completenessLabel)}`);

  // Accuracy line
  const accuracyLabel = health.accuracy.issues > 0
    ? `${health.accuracy.score}%  (${health.accuracy.issues} drift issues${health.accuracy.fixable > 0 ? `, ${health.accuracy.fixable} fixable` : ''})`
    : `${health.accuracy.score}%`;
  const accuracyColor = getHealthColor(getHealthStatus(health.accuracy.score));
  const lastBranch = !health.examples ? tree.corner : tree.branch;
  log(`${lastBranch} ${colors.muted('accuracy')}      ${accuracyColor(accuracyLabel)}`);

  // Examples line (if present)
  if (health.examples) {
    const examplesLabel = health.examples.failed > 0
      ? `${health.examples.score}%  (${health.examples.failed} failed)`
      : `${health.examples.score}%`;
    const examplesColor = getHealthColor(getHealthStatus(health.examples.score));
    log(`${tree.corner} ${colors.muted('examples')}      ${examplesColor(examplesLabel)}`);
  }
}

/**
 * Display verbose health breakdown with detailed per-category metrics
 */
export function displayHealthVerbose(
  health: import('@doccov/spec').DocumentationHealth,
  log: typeof console.log,
): void {
  const tree = supportsUnicode()
    ? { branch: '├─', corner: '└─' }
    : { branch: '|-', corner: '\\-' };

  // COMPLETENESS section
  log(colors.bold('COMPLETENESS') + `  ${health.completeness.score}%`);
  const missingRules = Object.entries(health.completeness.missing) as Array<[string, number]>;

  for (let i = 0; i < missingRules.length; i++) {
    const [rule, count] = missingRules[i];
    const isLast = i === missingRules.length - 1;
    const prefix = isLast ? tree.corner : tree.branch;
    const label = count > 0 ? `(${count} missing)` : '';
    const pct = health.completeness.total > 0
      ? Math.round(((health.completeness.total - count) / health.completeness.total) * 100)
      : 100;
    const color = getHealthColor(getHealthStatus(pct));
    log(`${prefix} ${colors.muted(rule.padEnd(12))} ${color(`${pct}%`)}  ${colors.muted(label)}`);
  }

  log('');

  // ACCURACY section
  log(colors.bold('ACCURACY') + `  ${health.accuracy.score}%  ${colors.muted(`(${health.accuracy.issues} issues)`)}`);
  const categories = Object.entries(health.accuracy.byCategory) as Array<[string, number]>;
  for (let i = 0; i < categories.length; i++) {
    const [category, count] = categories[i];
    const isLast = i === categories.length - 1;
    const prefix = isLast ? tree.corner : tree.branch;
    log(`${prefix} ${colors.muted(category.padEnd(12))} ${count}`);
  }

  // EXAMPLES section (if present)
  if (health.examples) {
    log('');
    log(colors.bold('EXAMPLES') + `  ${health.examples.score}%`);
    log(`${tree.branch} ${colors.muted('passed'.padEnd(12))} ${health.examples.passed}`);
    log(`${tree.corner} ${colors.muted('failed'.padEnd(12))} ${health.examples.failed}`);
  }
}

/**
 * Display text summary output
 */
export function displayTextOutput(options: TextOutputOptions, deps: TextOutputDeps): boolean {
  const {
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
    verbose,
  } = options;
  const { log } = deps;

  const sym = getSymbols(supportsUnicode());

  // Get health score from doccov
  const health = doccov.summary.health;
  const healthScore = health?.score ?? coverageScore;

  // Calculate drift percentage for display
  const totalExportsForDrift = openpkg.exports?.length ?? 0;
  const exportsWithDrift = new Set(driftExports.map((d) => d.name)).size;
  const driftScore =
    totalExportsForDrift === 0 ? 0 : Math.round((exportsWithDrift / totalExportsForDrift) * 100);

  // API Surface metrics
  const apiSurface = doccov.apiSurface;
  const apiSurfaceScore = apiSurface?.completeness ?? 100;
  const forgottenCount = apiSurface?.forgotten?.length ?? 0;

  // Check thresholds using health score
  const healthFailed = healthScore < minHealth;
  const apiSurfaceFailed = minApiSurface !== undefined && apiSurfaceScore < minApiSurface;
  const apiSurfaceWarn =
    warnBelowApiSurface !== undefined && apiSurfaceScore < warnBelowApiSurface && !apiSurfaceFailed;
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

  // Render package header
  const pkgName = openpkg.meta?.name ?? 'unknown';
  const pkgVersion = openpkg.meta?.version ?? '';

  log('');
  log(colors.bold(`${pkgName}${pkgVersion ? ` v${pkgVersion}` : ''}`));
  log('');

  // Show stale refs status
  const hasStaleRefs = staleRefs.length > 0;

  // Display health score prominently with tree breakdown
  if (health) {
    const healthColor = getHealthColor(getHealthStatus(health.score));
    log(`${colors.muted('Health')}   ${healthColor(`${health.score}%`)}`);

    if (verbose) {
      // Verbose mode: detailed per-category breakdown
      log('');
      displayHealthVerbose(health, log);
    } else {
      // Compact mode: tree view with completeness/accuracy
      displayHealthTree(health, log);
    }
  } else {
    // Fallback to legacy summary if no health data
    const summaryBuilder = createSummary({ keyWidth: 10 });
    summaryBuilder.addKeyValue('Exports', openpkg.exports?.length ?? 0);
    summaryBuilder.addKeyValue('Coverage', `${coverageScore}%`);
    summaryBuilder.addKeyValue('Drift', `${driftScore}%`);
    summaryBuilder.print();
  }

  log('');

  // Show API Surface status (only if there are forgotten exports or threshold is set)
  if (forgottenCount > 0 || minApiSurface !== undefined || warnBelowApiSurface !== undefined) {
    const surfaceLabel =
      forgottenCount > 0
        ? `${apiSurfaceScore}% (${forgottenCount} forgotten)`
        : `${apiSurfaceScore}%`;
    const surfaceColor = apiSurfaceFailed
      ? colors.error
      : apiSurfaceWarn || forgottenCount > 0
        ? colors.warning
        : colors.success;
    log(`${colors.muted('API Surface')}  ${surfaceColor(surfaceLabel)}`);
  }

  // Show stale docs status
  if (hasStaleRefs) {
    log(`${colors.muted('Stale refs')}   ${colors.warning(`${staleRefs.length} found`)}`);
  }

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

  // Display detailed forgotten exports in verbose mode
  if (verbose && forgottenCount > 0 && apiSurface?.forgotten) {
    log('');
    log(colors.bold(`Forgotten Exports (${forgottenCount})`));
    log('');
    for (const forgotten of apiSurface.forgotten.slice(0, 10)) {
      log(`  ${colors.warning(forgotten.name)}`);
      if (forgotten.definedIn) {
        log(
          colors.muted(
            `    Defined in: ${forgotten.definedIn.file}${forgotten.definedIn.line ? `:${forgotten.definedIn.line}` : ''}`,
          ),
        );
      }
      if (forgotten.referencedBy.length > 0) {
        log(colors.muted('    Referenced by:'));
        for (const ref of forgotten.referencedBy.slice(0, 3)) {
          log(colors.muted(`      - ${ref.exportName} (${ref.location})`));
        }
        if (forgotten.referencedBy.length > 3) {
          log(colors.muted(`      ... and ${forgotten.referencedBy.length - 3} more`));
        }
      }
      if (forgotten.fix) {
        log(colors.info(`    Fix: Add to ${forgotten.fix.targetFile}:`));
        log(colors.info(`      ${forgotten.fix.exportStatement}`));
      }
    }
    if (apiSurface.forgotten.length > 10) {
      log(colors.muted(`  ... and ${apiSurface.forgotten.length - 10} more`));
    }
  }

  log('');

  // Show pass/fail status
  const failed = healthFailed || apiSurfaceFailed || hasTypecheckErrors || hasStaleRefs;

  if (!failed) {
    const thresholdParts: string[] = [];
    thresholdParts.push(`health ${healthScore}% ≥ ${minHealth}%`);
    if (minApiSurface !== undefined) {
      thresholdParts.push(`api-surface ${apiSurfaceScore}% ≥ ${minApiSurface}%`);
    }

    log(colors.success(`${sym.success} Check passed (${thresholdParts.join(', ')})`));

    // Show warning if below warning threshold but above error threshold
    if (apiSurfaceWarn) {
      log(
        colors.warning(
          `${sym.warning} API Surface ${apiSurfaceScore}% below warning threshold ${warnBelowApiSurface}%`,
        ),
      );
    }

    // Hint about --verbose if not already verbose and health data available
    if (!verbose && health) {
      log(colors.muted('Use --verbose for detailed breakdown'));
    }

    return true; // passed
  }

  // Show failure reasons
  if (healthFailed) {
    log(colors.error(`${sym.error} Health ${healthScore}% below minimum ${minHealth}%`));
  }
  if (apiSurfaceFailed) {
    log(
      colors.error(`${sym.error} API Surface ${apiSurfaceScore}% below minimum ${minApiSurface}%`),
    );
  }
  if (hasTypecheckErrors) {
    log(colors.error(`${sym.error} ${typecheckErrors.length} example type errors`));
  }
  if (hasStaleRefs) {
    log(colors.error(`${sym.error} ${staleRefs.length} stale references in docs`));
  }

  // Hint about --fix if there are fixable drift issues
  if (health && health.accuracy.fixable > 0) {
    log('');
    log(colors.muted(`Use --fix to auto-fix ${health.accuracy.fixable} drift issue(s)`));
  }

  return false; // failed
}

export interface NonTextOutputOptions {
  format: OutputFormat;
  openpkg: OpenPkg;
  doccov: DocCovSpec;
  coverageScore: number;
  minHealth: number;
  minApiSurface: number | undefined;
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
    minHealth,
    minApiSurface,
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

  // Get health score
  const healthScore = doccov.summary.health?.score ?? coverageScore;

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

  // Check thresholds using health score
  const healthFailed = healthScore < minHealth;
  const apiSurfaceScore = doccov.apiSurface?.completeness ?? 100;
  const apiSurfaceFailed = minApiSurface !== undefined && apiSurfaceScore < minApiSurface;
  const hasTypecheckErrors = typecheckErrors.length > 0;

  return !(healthFailed || apiSurfaceFailed || hasTypecheckErrors);
}

/**
 * Display focused API surface output (--api-surface flag)
 */
export function displayApiSurfaceOutput(
  doccov: DocCovSpec,
  deps: { log: typeof console.log },
): void {
  const { log } = deps;
  const apiSurface = doccov.apiSurface;

  log('');
  log(colors.bold('API Surface Analysis'));
  log('');

  if (!apiSurface) {
    log(colors.muted('No API surface data available'));
    return;
  }

  const sym = getSymbols(supportsUnicode());

  // Summary
  const summaryBuilder = createSummary({ keyWidth: 12 });
  summaryBuilder.addKeyValue('Referenced', apiSurface.totalReferenced);
  summaryBuilder.addKeyValue('Exported', apiSurface.exported);
  summaryBuilder.addKeyValue('Forgotten', apiSurface.forgotten.length);
  summaryBuilder.addKeyValue(
    'Completeness',
    `${apiSurface.completeness}%`,
    apiSurface.forgotten.length > 0 ? 'warn' : 'pass',
  );
  summaryBuilder.print();

  // Detailed forgotten exports
  if (apiSurface.forgotten.length > 0) {
    log('');
    log(colors.bold(`Forgotten Exports (${apiSurface.forgotten.length})`));
    log('');

    for (const forgotten of apiSurface.forgotten) {
      log(`  ${colors.warning(forgotten.name)}`);
      if (forgotten.definedIn) {
        log(
          colors.muted(
            `    Defined in: ${forgotten.definedIn.file}${forgotten.definedIn.line ? `:${forgotten.definedIn.line}` : ''}`,
          ),
        );
      }
      if (forgotten.referencedBy.length > 0) {
        log(colors.muted('    Referenced by:'));
        for (const ref of forgotten.referencedBy.slice(0, 5)) {
          log(colors.muted(`      - ${ref.exportName} (${ref.location})`));
        }
        if (forgotten.referencedBy.length > 5) {
          log(colors.muted(`      ... and ${forgotten.referencedBy.length - 5} more`));
        }
      }
      if (forgotten.fix) {
        log(colors.info(`    Fix: Add to ${forgotten.fix.targetFile}:`));
        log(colors.info(`      ${forgotten.fix.exportStatement}`));
      }
      log('');
    }
  } else {
    log('');
    log(colors.success(`${sym.success} All referenced types are exported`));
  }
}
