import type { DriftSpec, DocumentationHealth } from '@driftdev/spec';
import type { OpenPkg } from '@openpkg-ts/spec';

/**
 * Result from analyzing a single package in batch mode.
 */
export interface PackageResult {
  /**
   * Package name (from openpkg.meta.name).
   */
  name: string;

  /**
   * Package version (from openpkg.meta.version).
   */
  version?: string;

  /**
   * Entry point path that was analyzed.
   */
  entryPath: string;

  /**
   * Total number of exports.
   */
  totalExports: number;

  /**
   * Number of documented exports.
   */
  documented: number;

  /**
   * Health score (0-100).
   */
  health: number;

  /**
   * Number of drift issues.
   */
  driftCount: number;

  /**
   * Coverage score (0-100).
   */
  coverageScore: number;

  /**
   * The full OpenPkg spec (for detailed reporting).
   */
  openpkg: OpenPkg;

  /**
   * The full Drift spec (for detailed reporting).
   */
  driftSpec: DriftSpec;
}

/**
 * Aggregated result from batch analysis.
 */
export interface BatchResult {
  /**
   * Individual package results.
   */
  packages: PackageResult[];

  /**
   * Aggregated metrics across all packages.
   */
  aggregate: {
    /**
     * Total exports across all packages.
     */
    totalExports: number;

    /**
     * Total documented exports across all packages.
     */
    documented: number;

    /**
     * Weighted average health score.
     */
    health: number;

    /**
     * Total drift issues across all packages.
     */
    driftCount: number;

    /**
     * Weighted average coverage score.
     */
    coverageScore: number;
  };
}

/**
 * Create a PackageResult from analyzed specs.
 *
 * @param openpkg - The OpenPkg spec
 * @param driftSpec - The Drift spec with coverage analysis
 * @param entryPath - Path to the entry point that was analyzed
 * @returns PackageResult for batch aggregation
 */
export function createPackageResult(
  openpkg: OpenPkg,
  driftSpec: DriftSpec,
  entryPath: string,
): PackageResult {
  const totalExports = driftSpec.summary.totalExports;
  const documented = driftSpec.summary.health?.completeness.documented ?? 0;
  const health = driftSpec.summary.health?.score ?? driftSpec.summary.score;
  const driftCount = driftSpec.summary.drift.total;
  const coverageScore = driftSpec.summary.score;

  return {
    name: openpkg.meta.name,
    version: openpkg.meta.version,
    entryPath,
    totalExports,
    documented,
    health,
    driftCount,
    coverageScore,
    openpkg,
    driftSpec,
  };
}

/**
 * Aggregate results from multiple package analyses.
 *
 * Health and coverage scores are weighted by export count so packages
 * with more exports have more influence on the aggregate.
 *
 * @param packages - Individual package results to aggregate
 * @returns BatchResult with aggregate metrics
 *
 * @example
 * ```ts
 * import { aggregateResults, createPackageResult } from '@driftdev/sdk';
 *
 * const results = [
 *   createPackageResult(pkg1Openpkg, pkg1Doccov, 'packages/a/src/index.ts'),
 *   createPackageResult(pkg2Openpkg, pkg2Doccov, 'packages/b/src/index.ts'),
 * ];
 *
 * const batch = aggregateResults(results);
 * console.log(`Total health: ${batch.aggregate.health}%`);
 * ```
 */
export function aggregateResults(packages: PackageResult[]): BatchResult {
  if (packages.length === 0) {
    return {
      packages: [],
      aggregate: {
        totalExports: 0,
        documented: 0,
        health: 0,
        driftCount: 0,
        coverageScore: 0,
      },
    };
  }

  const totalExports = packages.reduce((sum, p) => sum + p.totalExports, 0);
  const documented = packages.reduce((sum, p) => sum + p.documented, 0);
  const driftCount = packages.reduce((sum, p) => sum + p.driftCount, 0);

  // Weighted average for health and coverage
  const weightedHealth =
    totalExports > 0
      ? Math.round(packages.reduce((sum, p) => sum + p.health * p.totalExports, 0) / totalExports)
      : 0;

  const weightedCoverage =
    totalExports > 0
      ? Math.round(
          packages.reduce((sum, p) => sum + p.coverageScore * p.totalExports, 0) / totalExports,
        )
      : 0;

  return {
    packages,
    aggregate: {
      totalExports,
      documented,
      health: weightedHealth,
      driftCount,
      coverageScore: weightedCoverage,
    },
  };
}
