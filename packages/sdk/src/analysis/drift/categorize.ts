import { isFixableDrift } from '../../fix';
import {
  type CategorizedDrift,
  DRIFT_CATEGORIES,
  type DriftCategory,
  type DriftSummary,
  type SpecDocDrift,
} from './types';

/**
 * Categorize a single drift issue.
 *
 * @param drift - The drift to categorize
 * @returns The drift with category and fixable metadata
 *
 * @example
 * ```ts
 * const drift: SpecDocDrift = {
 *   type: 'param-type-mismatch',
 *   target: 'userId',
 *   issue: 'Type mismatch'
 * };
 * const categorized = categorizeDrift(drift);
 * console.log(categorized.category); // => 'structural'
 * console.log(categorized.fixable);  // => true
 * ```
 */
export function categorizeDrift(drift: SpecDocDrift): CategorizedDrift {
  return {
    ...drift,
    category: DRIFT_CATEGORIES[drift.type],
    fixable: isFixableDrift(drift),
  };
}

/**
 * Group drifts by category.
 *
 * @param drifts - Array of drift issues to group
 * @returns Drifts organized by category
 *
 * @example
 * ```ts
 * const grouped = groupDriftsByCategory(spec.docs.drift ?? []);
 * console.log(grouped.structural.length); // Number of structural issues
 * console.log(grouped.semantic.length);   // Number of semantic issues
 * console.log(grouped.example.length);    // Number of example issues
 * ```
 */
export function groupDriftsByCategory(
  drifts: SpecDocDrift[],
): Record<DriftCategory, CategorizedDrift[]> {
  const grouped: Record<DriftCategory, CategorizedDrift[]> = {
    structural: [],
    semantic: [],
    example: [],
    prose: [],
  };

  for (const drift of drifts) {
    const categorized = categorizeDrift(drift);
    grouped[categorized.category].push(categorized);
  }

  return grouped;
}

/**
 * Get drift summary counts by category.
 *
 * @param drifts - Array of drift issues
 * @returns Summary with totals, category breakdown, and fixable count
 *
 * @example
 * ```ts
 * const summary = getDriftSummary(exportEntry.docs?.drift ?? []);
 * console.log(`${summary.total} issues: ${summary.fixable} fixable`);
 * // => "5 issues: 3 fixable"
 * ```
 */
export function getDriftSummary(drifts: SpecDocDrift[]): DriftSummary {
  const grouped = groupDriftsByCategory(drifts);

  return {
    total: drifts.length,
    byCategory: {
      structural: grouped.structural.length,
      semantic: grouped.semantic.length,
      example: grouped.example.length,
      prose: grouped.prose.length,
    },
    fixable: drifts.filter((d) => isFixableDrift(d)).length,
  };
}

/**
 * Format drift summary for CLI output (single line).
 *
 * @param summary - Drift summary to format
 * @returns Human-readable summary string
 *
 * @example
 * ```ts
 * const summary = getDriftSummary(drifts);
 * console.log(formatDriftSummaryLine(summary));
 * // => "5 issues (3 structural, 1 semantic, 1 example)"
 * ```
 */
export function formatDriftSummaryLine(summary: DriftSummary): string {
  if (summary.total === 0) {
    return 'No drift detected';
  }

  const parts: string[] = [];

  if (summary.byCategory.structural > 0) {
    parts.push(`${summary.byCategory.structural} structural`);
  }
  if (summary.byCategory.semantic > 0) {
    parts.push(`${summary.byCategory.semantic} semantic`);
  }
  if (summary.byCategory.example > 0) {
    parts.push(`${summary.byCategory.example} example`);
  }
  if (summary.byCategory.prose > 0) {
    parts.push(`${summary.byCategory.prose} prose`);
  }

  const fixableNote = summary.fixable > 0 ? ` (${summary.fixable} auto-fixable)` : '';

  return `${summary.total} issues (${parts.join(', ')})${fixableNote}`;
}
