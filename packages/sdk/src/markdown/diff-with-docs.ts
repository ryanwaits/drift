/**
 * Extended spec diff with docs impact analysis
 *
 * Wraps the base diffSpec() and adds markdown impact detection
 */

import {
  type CategorizedBreaking,
  categorizeBreakingChanges,
  diffSpec,
  type OpenPkg,
  type SpecDiff,
} from '@openpkg-ts/spec';
import { analyzeDocsImpact } from './analyzer';
import { diffMemberChanges, type MemberChange } from './member-diff';
import type { DocsImpactResult, MarkdownDocFile } from './types';

/**
 * Extended spec diff result with docs impact
 */
export interface SpecDiffWithDocs extends SpecDiff {
  /** Docs impact analysis (only present if markdown files provided) */
  docsImpact?: DocsImpactResult;
  /** Member-level changes for classes (methods added/removed/changed) */
  memberChanges?: MemberChange[];
  /** Breaking changes categorized by severity (high/medium/low) */
  categorizedBreaking?: CategorizedBreaking[];
  /** Coverage score from old spec */
  oldCoverage: number;
  /** Coverage score from new spec */
  newCoverage: number;
  /** Change in coverage (newCoverage - oldCoverage) */
  coverageDelta: number;
  /** Number of new drift issues introduced */
  driftIntroduced: number;
  /** Number of drift issues resolved */
  driftResolved: number;
  /** New exports that are undocumented */
  newUndocumented: string[];
  /** Exports with improved coverage */
  improvedExports: string[];
  /** Exports with regressed coverage */
  regressedExports: string[];
}

/**
 * Options for diffSpecWithDocs
 */
export interface DiffWithDocsOptions {
  /** Parsed markdown documentation files */
  markdownFiles?: MarkdownDocFile[];
}

/**
 * Compute spec diff with optional docs impact analysis
 *
 * @param oldSpec - Previous version of the spec
 * @param newSpec - Current version of the spec
 * @param options - Options including markdown files to analyze
 * @returns Extended diff result with docs impact
 *
 * @example
 * ```ts
 * import { diffSpecWithDocs, parseMarkdownFiles } from '@driftdev/sdk';
 * import type { OpenPkg } from '@openpkg-ts/spec';
 *
 * const oldSpec: OpenPkg = { openpkg: '0.2.0', meta: { name: 'my-pkg' }, exports: [] };
 * const newSpec: OpenPkg = { openpkg: '0.2.1', meta: { name: 'my-pkg' }, exports: [] };
 *
 * const markdownFiles = parseMarkdownFiles([
 *   { path: 'docs/guide.md', content: '...' },
 * ]);
 *
 * const diff = diffSpecWithDocs(oldSpec, newSpec, { markdownFiles });
 *
 * if (diff.docsImpact?.impactedFiles.length) {
 *   console.log('Docs need updating!');
 * }
 * ```
 */
export function diffSpecWithDocs(
  oldSpec: OpenPkg,
  newSpec: OpenPkg,
  options: DiffWithDocsOptions = {},
): SpecDiffWithDocs {
  // Get base diff
  const baseDiff = diffSpec(oldSpec, newSpec);

  // Get member-level changes for classes marked as breaking
  const memberChanges = diffMemberChanges(oldSpec, newSpec, baseDiff.breaking);

  // Categorize breaking changes by severity
  const categorizedBreaking = categorizeBreakingChanges(
    baseDiff.breaking,
    oldSpec,
    newSpec,
    memberChanges,
  );

  // Calculate coverage metrics
  const { oldCoverage, newCoverage, coverageDelta, improvedExports, regressedExports } =
    computeCoverageMetrics(oldSpec, newSpec);

  // Calculate drift metrics
  const { driftIntroduced, driftResolved } = computeDriftMetrics(oldSpec, newSpec);

  // Find undocumented new exports
  const oldExportIds = new Set(oldSpec.exports?.map((e) => e.id) ?? []);
  const newUndocumented = (newSpec.exports ?? [])
    .filter((e) => !oldExportIds.has(e.id) && !hasDocumentation(e as EnrichedExport))
    .map((e) => e.name);

  // Build base result
  const baseResult: SpecDiffWithDocs = {
    ...baseDiff,
    memberChanges: memberChanges.length > 0 ? memberChanges : undefined,
    categorizedBreaking: categorizedBreaking.length > 0 ? categorizedBreaking : undefined,
    oldCoverage,
    newCoverage,
    coverageDelta,
    driftIntroduced,
    driftResolved,
    newUndocumented,
    improvedExports,
    regressedExports,
  };

  // If no markdown files, return base result
  if (!options.markdownFiles?.length) {
    return baseResult;
  }

  // Get all export names from new spec for missing docs detection
  const newExportNames = newSpec.exports?.map((e) => e.name) ?? [];

  // Analyze docs impact with member-level granularity
  const docsImpact = analyzeDocsImpact(
    baseDiff,
    options.markdownFiles,
    newExportNames,
    memberChanges,
  );

  return {
    ...baseResult,
    docsImpact,
  };
}

/** Enriched export type with docs property added by SDK */
type EnrichedExport = {
  id: string;
  name: string;
  description?: string;
  docs?: { description?: string; coverageScore?: number; drift?: unknown[] };
};

/**
 * Compute coverage metrics between two specs
 */
function computeCoverageMetrics(
  oldSpec: OpenPkg,
  newSpec: OpenPkg,
): {
  oldCoverage: number;
  newCoverage: number;
  coverageDelta: number;
  improvedExports: string[];
  regressedExports: string[];
} {
  const oldCoverage = getSpecCoverage(oldSpec);
  const newCoverage = getSpecCoverage(newSpec);
  const coverageDelta = newCoverage - oldCoverage;

  // Track improved/regressed exports
  const oldExportScores = new Map<string, number>();
  for (const exp of oldSpec.exports ?? []) {
    const enriched = exp as EnrichedExport;
    oldExportScores.set(exp.id, enriched.docs?.coverageScore ?? 0);
  }

  const improvedExports: string[] = [];
  const regressedExports: string[] = [];

  for (const exp of newSpec.exports ?? []) {
    const enriched = exp as EnrichedExport;
    const oldScore = oldExportScores.get(exp.id);
    if (oldScore === undefined) continue; // New export, skip

    const newScore = enriched.docs?.coverageScore ?? 0;
    if (newScore > oldScore) {
      improvedExports.push(exp.name);
    } else if (newScore < oldScore) {
      regressedExports.push(exp.name);
    }
  }

  return { oldCoverage, newCoverage, coverageDelta, improvedExports, regressedExports };
}

/**
 * Get coverage score from spec
 */
function getSpecCoverage(spec: OpenPkg): number {
  const exports = spec.exports ?? [];
  if (exports.length === 0) return 0;

  const totalScore = exports.reduce((sum, exp) => {
    const enriched = exp as EnrichedExport;
    return sum + (enriched.docs?.coverageScore ?? 0);
  }, 0);
  return Math.round(totalScore / exports.length);
}

/**
 * Compute drift metrics between two specs
 */
function computeDriftMetrics(
  oldSpec: OpenPkg,
  newSpec: OpenPkg,
): { driftIntroduced: number; driftResolved: number } {
  const oldDriftCount = countDriftIssues(oldSpec);
  const newDriftCount = countDriftIssues(newSpec);

  // Simplified: if drift increased, those are "introduced"; if decreased, "resolved"
  const driftIntroduced = Math.max(0, newDriftCount - oldDriftCount);
  const driftResolved = Math.max(0, oldDriftCount - newDriftCount);

  return { driftIntroduced, driftResolved };
}

/**
 * Count total drift issues in spec
 */
function countDriftIssues(spec: OpenPkg): number {
  return (spec.exports ?? []).reduce((sum, exp) => {
    const enriched = exp as EnrichedExport;
    return sum + (enriched.docs?.drift?.length ?? 0);
  }, 0);
}

/**
 * Check if an export has documentation
 */
function hasDocumentation(exp: EnrichedExport): boolean {
  return Boolean(exp.docs?.description || exp.description);
}

/**
 * Check if a diff has any docs impact
 */
export function hasDocsImpact(diff: SpecDiffWithDocs): boolean {
  if (!diff.docsImpact) return false;
  return diff.docsImpact.impactedFiles.length > 0 || diff.docsImpact.missingDocs.length > 0;
}

/**
 * Get summary of docs impact for display
 */
export function getDocsImpactSummary(diff: SpecDiffWithDocs): {
  impactedFileCount: number;
  impactedReferenceCount: number;
  missingDocsCount: number;
  totalIssues: number;
  memberChangesCount: number;
} {
  if (!diff.docsImpact) {
    return {
      impactedFileCount: 0,
      impactedReferenceCount: 0,
      missingDocsCount: 0,
      totalIssues: 0,
      memberChangesCount: diff.memberChanges?.length ?? 0,
    };
  }

  const impactedFileCount = diff.docsImpact.impactedFiles.length;
  const impactedReferenceCount = diff.docsImpact.impactedFiles.reduce(
    (sum, f) => sum + f.references.length,
    0,
  );
  const missingDocsCount = diff.docsImpact.missingDocs.length;

  return {
    impactedFileCount,
    impactedReferenceCount,
    missingDocsCount,
    totalIssues: impactedReferenceCount + missingDocsCount,
    memberChangesCount: diff.memberChanges?.length ?? 0,
  };
}
