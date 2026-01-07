import { getExportAnalysis, getExportDrift, isFixableDrift, type SpecDocDrift } from '@doccov/sdk';
import {
  type ApiSurfaceResult,
  type DocCovSpec,
  type DocumentationHealth,
  DRIFT_CATEGORIES,
  type DriftCategory,
  type DriftType,
} from '@doccov/spec';
import type { OpenPkg, SpecExportKind } from '@openpkg-ts/spec';

export type SignalStats = { covered: number; total: number; pct: number };

export type DriftIssueItem = {
  exportName: string;
  type: string;
  issue: string;
  expected?: string;
  actual?: string;
  suggestion?: string;
};

export type DriftSummaryStats = {
  total: number;
  byCategory: Record<DriftCategory, number>;
  fixable: number;
};

export type StaleReferenceItem = {
  file: string;
  line: number;
  exportName: string;
  context: string;
};

export type ReportStats = {
  packageName: string;
  version: string;
  coverageScore: number;
  driftScore: number;
  totalExports: number;
  fullyDocumented: number;
  partiallyDocumented: number;
  undocumented: number;
  driftCount: number;
  signalCoverage: Record<'description' | 'params' | 'returns' | 'examples', SignalStats>;
  byKind: Array<{ kind: SpecExportKind; count: number; avgScore: number }>;
  exports: Array<{ name: string; kind: SpecExportKind; score: number; missing: string[] }>;
  driftIssues: DriftIssueItem[];
  driftByCategory: Record<DriftCategory, DriftIssueItem[]>;
  driftSummary: DriftSummaryStats;
  apiSurface?: ApiSurfaceResult;
  health?: DocumentationHealth;
  staleRefs?: StaleReferenceItem[];
};

export interface ComputeStatsOptions {
  staleRefs?: StaleReferenceItem[];
}

/**
 * Compute report statistics from an OpenPkg spec and DocCov spec.
 */
export function computeStats(
  openpkg: OpenPkg,
  doccov: DocCovSpec,
  options: ComputeStatsOptions = {},
): ReportStats {
  const exports = openpkg.exports ?? [];
  const signals = {
    description: { covered: 0, total: 0 },
    params: { covered: 0, total: 0 },
    returns: { covered: 0, total: 0 },
    examples: { covered: 0, total: 0 },
  };
  const kindMap = new Map<SpecExportKind, { count: number; totalScore: number }>();
  const driftIssues: DriftIssueItem[] = [];
  const driftByCategory: Record<DriftCategory, DriftIssueItem[]> = {
    structural: [],
    semantic: [],
    example: [],
  };
  let fullyDocumented = 0;
  let partiallyDocumented = 0;
  let undocumented = 0;

  for (const exp of exports) {
    const analysis = getExportAnalysis(exp, doccov);
    const score = analysis?.coverageScore ?? 0;
    const missing = analysis?.missing ?? [];

    // Tally signals
    for (const sig of ['description', 'params', 'returns', 'examples'] as const) {
      signals[sig].total++;
      if (!missing.includes(sig)) signals[sig].covered++;
    }

    // Tally by kind
    const kindEntry = kindMap.get(exp.kind) ?? { count: 0, totalScore: 0 };
    kindEntry.count++;
    kindEntry.totalScore += score;
    kindMap.set(exp.kind, kindEntry);

    // Categorize
    if (score === 100) fullyDocumented++;
    else if (score > 0) partiallyDocumented++;
    else undocumented++;

    // Collect drift and categorize
    for (const d of getExportDrift(exp, doccov)) {
      const item: DriftIssueItem = {
        exportName: exp.name,
        type: d.type,
        issue: d.issue,
        expected: d.expected,
        actual: d.actual,
        suggestion: d.suggestion,
      };
      driftIssues.push(item);

      // Add to category bucket
      const category = DRIFT_CATEGORIES[d.type as DriftType] ?? 'semantic';
      driftByCategory[category].push(item);
    }
  }

  const signalCoverage = Object.fromEntries(
    Object.entries(signals).map(([k, v]) => [
      k,
      { ...v, pct: v.total ? Math.round((v.covered / v.total) * 100) : 0 },
    ]),
  ) as ReportStats['signalCoverage'];

  const byKind = Array.from(kindMap.entries())
    .map(([kind, { count, totalScore }]) => ({
      kind,
      count,
      avgScore: Math.round(totalScore / count),
    }))
    .sort((a, b) => b.count - a.count);

  const sortedExports = exports
    .map((e) => {
      const analysis = getExportAnalysis(e, doccov);
      return {
        name: e.name,
        kind: e.kind,
        score: analysis?.coverageScore ?? 0,
        missing: analysis?.missing ?? [],
      };
    })
    .sort((a, b) => a.score - b.score);

  // Compute drift summary
  const driftSummary: DriftSummaryStats = {
    total: driftIssues.length,
    byCategory: {
      structural: driftByCategory.structural.length,
      semantic: driftByCategory.semantic.length,
      example: driftByCategory.example.length,
    },
    fixable: driftIssues.filter((d) =>
      isFixableDrift({ type: d.type as DriftType } as SpecDocDrift),
    ).length,
  };

  // Compute drift score (% of exports with drift issues)
  const exportsWithDrift = new Set(driftIssues.map((d) => d.exportName)).size;
  const driftScore =
    exports.length === 0 ? 0 : Math.round((exportsWithDrift / exports.length) * 100);

  return {
    packageName: openpkg.meta.name ?? 'unknown',
    version: openpkg.meta.version ?? '0.0.0',
    coverageScore: doccov.summary.score,
    driftScore,
    totalExports: exports.length,
    fullyDocumented,
    partiallyDocumented,
    undocumented,
    driftCount: driftIssues.length,
    signalCoverage,
    byKind,
    exports: sortedExports,
    driftIssues,
    driftByCategory,
    driftSummary,
    apiSurface: doccov.apiSurface,
    health: doccov.summary.health,
    staleRefs: options.staleRefs,
  };
}
