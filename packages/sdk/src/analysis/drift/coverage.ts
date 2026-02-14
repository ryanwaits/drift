import type { ApiSpec } from '../api-spec';

/**
 * Calculate aggregate coverage score from a spec's exports.
 *
 * This is a lightweight function that calculates coverage without
 * requiring full quality evaluation. It handles three cases:
 * 1. Exports with `docs.coverageScore` - uses that value
 * 2. Exports without score but with description - counts as 100%
 * 3. Exports without score and no description - counts as 0%
 *
 * @param spec - The OpenPkg spec to calculate coverage for
 * @returns The aggregate coverage score (0-100)
 *
 * @example
 * ```ts
 * import { calculateAggregateCoverage } from '@driftdev/sdk';
 *
 * const coverage = calculateAggregateCoverage(spec);
 * console.log(`Coverage: ${coverage}%`);
 * ```
 */
export function calculateAggregateCoverage(spec: ApiSpec): number {
  const exports = spec.exports ?? [];
  if (exports.length === 0) return 100;

  let totalScore = 0;

  for (const exp of exports) {
    // Use existing coverage score if available (added by enrichment)
    const enrichedExp = exp as { docs?: { coverageScore?: number }; description?: string };
    const score = enrichedExp.docs?.coverageScore;
    if (score !== undefined) {
      totalScore += score;
    } else {
      // Fall back to description-based check
      totalScore += exp.description ? 100 : 0;
    }
  }

  return Math.round(totalScore / exports.length);
}

/**
 * Ensure a spec has a top-level docs.coverageScore.
 *
 * If the spec already has `docs.coverageScore`, returns the spec unchanged.
 * Otherwise, calculates aggregate coverage from exports and returns a
 * new spec with the coverage score added.
 *
 * This is useful for commands like `diff` that need coverage scores
 * but may receive raw specs that haven't been enriched.
 *
 * @param spec - The OpenPkg spec to ensure coverage for
 * @returns The spec with guaranteed top-level coverage score
 *
 * @example
 * ```ts
 * import { ensureSpecCoverage } from '@driftdev/sdk';
 *
 * // Works with raw or enriched specs
 * const specWithCoverage = ensureSpecCoverage(rawSpec);
 * console.log(specWithCoverage.docs?.coverageScore); // e.g., 85
 * ```
 */
export function ensureSpecCoverage(
  spec: ApiSpec,
): ApiSpec & { docs: { coverageScore: number } } {
  type SpecWithDocs = ApiSpec & { docs?: { coverageScore?: number } };
  const specWithDocs = spec as SpecWithDocs;

  // Already has top-level coverage
  if (specWithDocs.docs?.coverageScore !== undefined) {
    return spec as ApiSpec & { docs: { coverageScore: number } };
  }

  // Calculate and add coverage
  const coverage = calculateAggregateCoverage(spec);
  return {
    ...spec,
    docs: {
      ...(specWithDocs.docs ?? {}),
      coverageScore: coverage,
    },
  } as ApiSpec & { docs: { coverageScore: number } };
}
