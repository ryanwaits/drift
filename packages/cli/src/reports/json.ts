import type { DocCovReport } from '@doccov/sdk';

/**
 * CI-friendly JSON output options.
 */
export interface CIJsonOptions {
  /** Minimum health percentage required (0-100) */
  minHealth?: number;
  /** Whether typecheck errors were found */
  hasTypecheckErrors?: boolean;
  /** Whether runtime errors were found */
  hasRuntimeErrors?: boolean;
  /** Whether stale references were found */
  hasStaleRefs?: boolean;
}

/**
 * Threshold status for a specific metric.
 */
export interface ThresholdStatus {
  /** Configured minimum value */
  min: number;
  /** Actual value */
  actual: number;
  /** Whether the threshold passed */
  passed: boolean;
}

/**
 * CI-friendly JSON report with threshold checking and exit code.
 */
export interface CIJsonReport {
  /** Whether all checks passed */
  success: boolean;
  /** Health score (0-100) */
  health: number;
  /** Threshold configurations and pass/fail status */
  thresholds: {
    health: ThresholdStatus;
  };
  /** Drift summary */
  drift: {
    total: number;
    fixable: number;
  };
  /** Exports summary */
  exports: {
    total: number;
    documented: number;
  };
  /** Suggested exit code for CI (0 = success, 1 = failure) */
  exitCode: 0 | 1;
  /** Full report data (for detailed analysis) */
  report: DocCovReport;
}

/**
 * Format a DocCov report as CI-friendly JSON with threshold checking.
 *
 * @param report - The DocCov report to format
 * @param options - CI-specific options like thresholds
 * @returns CI-friendly JSON report
 *
 * @example
 * ```ts
 * const ciReport = formatCIJson(report, { minHealth: 80 });
 * if (ciReport.exitCode !== 0) {
 *   process.exit(ciReport.exitCode);
 * }
 * ```
 */
export function formatCIJson(report: DocCovReport, options: CIJsonOptions = {}): CIJsonReport {
  const minHealth = options.minHealth ?? 0;
  const health = report.health?.score ?? report.coverage.score;
  const healthPassed = health >= minHealth;

  // Check all conditions for success
  const hasTypecheckErrors = options.hasTypecheckErrors ?? false;
  const hasRuntimeErrors = options.hasRuntimeErrors ?? false;
  const hasStaleRefs = options.hasStaleRefs ?? false;

  const success = healthPassed && !hasTypecheckErrors && !hasRuntimeErrors && !hasStaleRefs;

  return {
    success,
    health,
    thresholds: {
      health: {
        min: minHealth,
        actual: health,
        passed: healthPassed,
      },
    },
    drift: {
      total: report.coverage.driftCount,
      fixable: report.coverage.driftSummary?.fixable ?? 0,
    },
    exports: {
      total: report.coverage.totalExports,
      documented: report.coverage.documentedExports,
    },
    exitCode: success ? 0 : 1,
    report,
  };
}
