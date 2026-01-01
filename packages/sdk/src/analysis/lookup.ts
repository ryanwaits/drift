/**
 * Helper functions for looking up export analysis data from DocCovSpec.
 *
 * These utilities simplify accessing per-export coverage/drift data
 * when working with the composition pattern (OpenPkg + DocCovSpec).
 */
import type { DocCovDrift, DocCovSpec, ExportAnalysis, MissingDocRule } from '@doccov/spec';
import type { SpecExport } from '@openpkg-ts/spec';

/**
 * Get the full analysis data for an export.
 *
 * @param exp - The export to look up
 * @param doccov - The DocCov spec containing analysis data
 * @returns Export analysis or undefined if not found
 */
export function getExportAnalysis(
  exp: SpecExport,
  doccov: DocCovSpec,
): ExportAnalysis | undefined {
  const id = exp.id ?? exp.name;
  return doccov.exports[id];
}

/**
 * Get the coverage score for an export.
 *
 * @param exp - The export to look up
 * @param doccov - The DocCov spec containing analysis data
 * @returns Coverage score (0-100) or 100 if not found
 */
export function getExportScore(exp: SpecExport, doccov: DocCovSpec): number {
  const analysis = getExportAnalysis(exp, doccov);
  return analysis?.coverageScore ?? 100;
}

/**
 * Get drift issues for an export.
 *
 * @param exp - The export to look up
 * @param doccov - The DocCov spec containing analysis data
 * @returns Array of drift issues or empty array if none
 */
export function getExportDrift(exp: SpecExport, doccov: DocCovSpec): DocCovDrift[] {
  const analysis = getExportAnalysis(exp, doccov);
  return analysis?.drift ?? [];
}

/**
 * Get missing documentation rules for an export.
 *
 * @param exp - The export to look up
 * @param doccov - The DocCov spec containing analysis data
 * @returns Array of missing rule IDs or empty array if none
 */
export function getExportMissing(exp: SpecExport, doccov: DocCovSpec): MissingDocRule[] {
  const analysis = getExportAnalysis(exp, doccov);
  return analysis?.missing ?? [];
}

/**
 * Check if an export has complete documentation.
 *
 * @param exp - The export to check
 * @param doccov - The DocCov spec containing analysis data
 * @returns True if export has 100% coverage and no drift
 */
export function isExportFullyDocumented(exp: SpecExport, doccov: DocCovSpec): boolean {
  const analysis = getExportAnalysis(exp, doccov);
  if (!analysis) return true;
  return analysis.coverageScore === 100 && (!analysis.drift || analysis.drift.length === 0);
}
