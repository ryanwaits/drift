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
  minCoverage: number;
  maxDrift: number | undefined;
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
 * Display text summary output
 */
export function displayTextOutput(options: TextOutputOptions, deps: TextOutputDeps): boolean {
  const {
    openpkg,
    doccov,
    coverageScore,
    minCoverage,
    maxDrift,
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

  // Calculate drift percentage
  const totalExportsForDrift = openpkg.exports?.length ?? 0;
  const exportsWithDrift = new Set(driftExports.map((d) => d.name)).size;
  const driftScore =
    totalExportsForDrift === 0 ? 0 : Math.round((exportsWithDrift / totalExportsForDrift) * 100);

  // API Surface metrics
  const apiSurface = doccov.apiSurface;
  const apiSurfaceScore = apiSurface?.completeness ?? 100;
  const forgottenCount = apiSurface?.forgotten?.length ?? 0;

  const coverageFailed = coverageScore < minCoverage;
  const driftFailed = maxDrift !== undefined && driftScore > maxDrift;
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

  // Show API Surface status (only if there are forgotten exports or threshold is set)
  if (forgottenCount > 0 || minApiSurface !== undefined || warnBelowApiSurface !== undefined) {
    const surfaceLabel =
      forgottenCount > 0
        ? `${apiSurfaceScore}% (${forgottenCount} forgotten)`
        : `${apiSurfaceScore}%`;
    if (apiSurfaceFailed) {
      summaryBuilder.addKeyValue('API Surface', surfaceLabel, 'fail');
    } else if (apiSurfaceWarn) {
      summaryBuilder.addKeyValue('API Surface', surfaceLabel, 'warn');
    } else if (minApiSurface !== undefined) {
      summaryBuilder.addKeyValue('API Surface', surfaceLabel, 'pass');
    } else {
      summaryBuilder.addKeyValue(
        'API Surface',
        surfaceLabel,
        forgottenCount > 0 ? 'warn' : undefined,
      );
    }
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
  const failed =
    coverageFailed || driftFailed || apiSurfaceFailed || hasTypecheckErrors || hasStaleRefs;

  if (!failed) {
    const thresholdParts: string[] = [];
    thresholdParts.push(`coverage ${coverageScore}% ≥ ${minCoverage}%`);
    if (maxDrift !== undefined) {
      thresholdParts.push(`drift ${driftScore}% ≤ ${maxDrift}%`);
    }
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

    return true; // passed
  }

  // Show failure reasons
  if (coverageFailed) {
    log(colors.error(`${sym.error} Coverage ${coverageScore}% below minimum ${minCoverage}%`));
  }
  if (driftFailed) {
    log(colors.error(`${sym.error} Drift ${driftScore}% exceeds maximum ${maxDrift}%`));
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
    minCoverage,
    maxDrift,
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
  const apiSurfaceScore = doccov.apiSurface?.completeness ?? 100;
  const apiSurfaceFailed = minApiSurface !== undefined && apiSurfaceScore < minApiSurface;
  const hasTypecheckErrors = typecheckErrors.length > 0;

  return !(coverageFailed || driftFailed || apiSurfaceFailed || hasTypecheckErrors);
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
