/**
 * Helper functions for looking up export analysis data from DriftSpec.
 *
 * These utilities simplify accessing per-export coverage/drift data
 * when working with the composition pattern (OpenPkg + DriftSpec).
 */
import type { DriftIssue, DriftSpec, ExportAnalysis, MissingDocRule } from '@driftdev/spec';
import type { SpecExport } from '@openpkg-ts/spec';

/**
 * Get the full analysis data for an export.
 *
 * @param exp - The export to look up
 * @param driftSpec - The Drift spec containing analysis data
 * @returns Export analysis or undefined if not found
 */
export function getExportAnalysis(exp: SpecExport, driftSpec: DriftSpec): ExportAnalysis | undefined {
  const id = exp.id ?? exp.name;
  return driftSpec.exports[id];
}

/**
 * Get the coverage score for an export.
 *
 * @param exp - The export to look up
 * @param driftSpec - The Drift spec containing analysis data
 * @returns Coverage score (0-100) or 100 if not found
 */
export function getExportScore(exp: SpecExport, driftSpec: DriftSpec): number {
  const analysis = getExportAnalysis(exp, driftSpec);
  return analysis?.coverageScore ?? 100;
}

/**
 * Get drift issues for an export.
 *
 * @param exp - The export to look up
 * @param driftSpec - The Drift spec containing analysis data
 * @returns Array of drift issues or empty array if none
 */
export function getExportDrift(exp: SpecExport, driftSpec: DriftSpec): DriftIssue[] {
  const analysis = getExportAnalysis(exp, driftSpec);
  return analysis?.drift ?? [];
}

/**
 * Get missing documentation rules for an export.
 *
 * @param exp - The export to look up
 * @param driftSpec - The Drift spec containing analysis data
 * @returns Array of missing rule IDs or empty array if none
 */
export function getExportMissing(exp: SpecExport, driftSpec: DriftSpec): MissingDocRule[] {
  const analysis = getExportAnalysis(exp, driftSpec);
  return analysis?.missing ?? [];
}

/**
 * Check if an export has complete documentation.
 *
 * @param exp - The export to check
 * @param driftSpec - The Drift spec containing analysis data
 * @returns True if export has 100% coverage and no drift
 */
export function isExportFullyDocumented(exp: SpecExport, driftSpec: DriftSpec): boolean {
  const analysis = getExportAnalysis(exp, driftSpec);
  if (!analysis) return true;
  return analysis.coverageScore === 100 && (!analysis.drift || analysis.drift.length === 0);
}
