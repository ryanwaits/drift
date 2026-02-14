/**
 * Utilities for extracting summary statistics from OpenPkg specs.
 */

import type { DriftSpec } from '../spec';
import type { OpenPkg } from '@openpkg-ts/spec';
import { getExportAnalysis } from '../analysis/lookup';

/**
 * A documentation drift issue in a spec summary.
 */
export interface SummaryDriftIssue {
  /** Name of the export with drift */
  export: string;
  /** Type of drift (e.g., 'param-mismatch', 'return-type') */
  type: string;
  /** Human-readable description of the issue */
  issue: string;
  /** Optional suggestion for fixing the issue */
  suggestion?: string;
}

/**
 * Summary of a spec's documentation coverage.
 * Simpler than full ReportStats - focused on scan output.
 */
export interface SpecSummary {
  /** Overall coverage percentage */
  coverage: number;
  /** Number of exports */
  exportCount: number;
  /** Number of types */
  typeCount: number;
  /** Number of drift issues */
  driftCount: number;
  /** Names of undocumented or partially documented exports */
  undocumented: string[];
  /** Drift issues */
  drift: SummaryDriftIssue[];
}

/**
 * Extract a summary from OpenPkg spec + Drift spec composition.
 *
 * This consolidates the logic previously duplicated in:
 * - CLI scan.ts (drift collection)
 * - CLI reports/stats.ts (computeStats)
 * - API scan-stream.ts (inline extraction script)
 *
 * @param openpkg - The pure OpenPkg spec
 * @param driftSpec - The Drift spec with analysis data
 * @returns Summary of documentation coverage
 *
 * @example
 * ```typescript
 * import { buildDriftSpec, extractSpecSummary } from '@driftdev/sdk';
 *
 * const driftSpec = buildDriftSpec({ openpkg: spec, openpkgPath: 'openpkg.json' });
 * const summary = extractSpecSummary(spec, driftSpec);
 * console.log(`Coverage: ${summary.coverage}%`);
 * console.log(`Undocumented: ${summary.undocumented.length}`);
 * ```
 */
export function extractSpecSummary(openpkg: OpenPkg, driftSpec: DriftSpec): SpecSummary {
  const exports = openpkg.exports ?? [];
  const undocumented: string[] = [];
  const drift: SummaryDriftIssue[] = [];

  for (const exp of exports) {
    const analysis = getExportAnalysis(exp, driftSpec);
    if (!analysis) continue;

    // Track undocumented or partially documented exports
    const hasMissing = (analysis.missing?.length ?? 0) > 0;
    const isPartial = (analysis.coverageScore ?? 0) < 100;
    if (hasMissing || isPartial) {
      undocumented.push(exp.name);
    }

    // Collect drift issues
    for (const d of analysis.drift ?? []) {
      drift.push({
        export: exp.name,
        type: d.type,
        issue: d.issue,
        suggestion: d.suggestion,
      });
    }
  }

  return {
    coverage: driftSpec.summary.score,
    exportCount: exports.length,
    typeCount: openpkg.types?.length ?? 0,
    driftCount: drift.length,
    undocumented,
    drift,
  };
}
