import type { DocumentationHealth, DriftCategory, MissingDocRule } from '../spec';
import type { SpecExport } from '@openpkg-ts/spec';

/**
 * Check if an export has meaningful documentation.
 * An export is considered documented if it has:
 * - A description
 * - Meaningful JSDoc tags
 * - For namespaces: description counts as documented (no examples required)
 */
export function isExportDocumented(exp: SpecExport): boolean {
  // Has direct description
  if (exp.description && exp.description.trim().length > 0) return true;

  // Has meaningful tags (excluding @internal which is filtered out elsewhere)
  const meaningfulTags = exp.tags?.filter((t) => t.name !== 'internal') ?? [];
  if (meaningfulTags.length > 0) return true;

  return false;
}

/**
 * Input data for computing documentation health score.
 */
export interface HealthInput {
  /** Coverage score (0-100) */
  coverageScore: number;
  /** Number of documented exports */
  documentedExports: number;
  /** Total exports analyzed */
  totalExports: number;
  /** Missing docs by rule */
  missingByRule: Record<MissingDocRule, number>;
  /** Total drift issues */
  driftIssues: number;
  /** Drift by category */
  driftByCategory: Record<DriftCategory, number>;
  /** Example validation results (optional) */
  examples?: { passed: number; failed: number; total: number };
}

/**
 * Compute unified documentation health score.
 *
 * Formula: health = completeness × (1 - drift_ratio × 0.5)
 * - Max 50% drift penalty
 * - Optional 30% example penalty if examples validated
 *
 * Score thresholds: green 80+, yellow 60-79, red <60
 */
export function computeHealth(input: HealthInput): DocumentationHealth {
  const {
    coverageScore,
    documentedExports,
    totalExports,
    missingByRule,
    driftIssues,
    driftByCategory,
    examples,
  } = input;

  // Completeness score is the coverage score
  const completenessScore = coverageScore;

  // Accuracy score: penalized by drift ratio (max 50% penalty)
  // drift_ratio = issues / total exports
  const driftRatio = totalExports > 0 ? driftIssues / totalExports : 0;
  const driftPenalty = Math.min(driftRatio * 0.5, 0.5); // cap at 50%
  const accuracyScore = Math.round((1 - driftPenalty) * 100);

  // Example score (if provided)
  let exampleScore: number | undefined;
  if (examples && examples.total > 0) {
    exampleScore = Math.round((examples.passed / examples.total) * 100);
  }

  // Overall health: completeness × (1 - drift_penalty)
  // If examples validated, apply additional penalty (max 30%)
  let health = completenessScore * (1 - driftPenalty);

  if (exampleScore !== undefined) {
    const examplePenalty = ((100 - exampleScore) / 100) * 0.3; // max 30% penalty
    health = health * (1 - examplePenalty);
  }

  const result: DocumentationHealth = {
    score: Math.round(health),
    completeness: {
      score: Math.round(completenessScore),
      documented: documentedExports,
      total: totalExports,
      missing: missingByRule,
    },
    accuracy: {
      score: accuracyScore,
      issues: driftIssues,
      byCategory: driftByCategory,
    },
  };

  if (examples) {
    result.examples = {
      score: exampleScore!,
      passed: examples.passed,
      failed: examples.failed,
      total: examples.total,
    };
  }

  return result;
}
