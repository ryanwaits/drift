/**
 * Health score: weighted composite of completeness + accuracy.
 *
 * Completeness = % exports with JSDoc description (same as coverage)
 * Accuracy = % documented exports where JSDoc matches actual signature
 * Health = completeness * 0.5 + accuracy * 0.5
 */

export interface HealthResult {
  health: number;
  completeness: number;
  accuracy: number;
  totalExports: number;
  documented: number;
  undocumented: number;
  drifted: number;
  issues: Array<{ export: string; issue: string }>;
}

export function computeHealth(
  totalExports: number,
  documented: number,
  issues: Array<{ export: string; issue: string }>,
): HealthResult {
  const undocumented = totalExports - documented;

  // Completeness: % of all exports that have a description
  const completeness = totalExports > 0 ? Math.round((documented / totalExports) * 100) : 100;

  // Accuracy: % of documented exports that have NO lint issues
  // Count unique exports with issues (not total issue count)
  const driftedExports = new Set(issues.map((i) => i.export));
  const drifted = driftedExports.size;
  const accurate = documented > 0 ? documented - drifted : 0;
  const accuracy = documented > 0 ? Math.round((Math.max(0, accurate) / documented) * 100) : 100;

  // Health = weighted average
  const health = Math.round(completeness * 0.5 + accuracy * 0.5);

  return {
    health,
    completeness,
    accuracy,
    totalExports,
    documented,
    undocumented,
    drifted,
    issues,
  };
}
