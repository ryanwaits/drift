import type {
  ApiSurfaceResult,
  DriftCategory,
  DriftIssue,
  DriftSpec,
  DriftSummary,
  ExportAnalysis,
  ForgottenExport,
  MissingDocRule,
  TypeReferenceLocation,
} from '@driftdev/spec';
import { DRIFT_CATEGORIES } from '@driftdev/spec';
import type { SpecExport } from '@openpkg-ts/spec';
import { isFixableDrift } from '../fix';
import { buildExportRegistry, computeExportDrift } from './drift/compute';
import { computeHealth, isExportDocumented } from './health';
import type { DocRequirements, StylePreset } from './presets';
import { resolveRequirements } from './presets';
import type { OpenPkgSpec } from './spec-types';

/**
 * Check if an export has the @internal tag.
 */
function hasInternalTag(exp: SpecExport): boolean {
  return exp.tags?.some((t) => t.name === 'internal') ?? false;
}

/** Forgotten export from extract package (different shape than spec type) */
export interface ExtractForgottenExport {
  name: string;
  definedIn?: string;
  referencedBy: Array<{
    typeName: string;
    exportName: string;
    location: TypeReferenceLocation;
    path?: string;
  }>;
  isExternal: boolean;
  fix?: string;
}

export interface BuildDriftOptions {
  openpkgPath: string;
  openpkg: OpenPkgSpec;
  packagePath?: string;
  /** Forgotten exports from extraction (for API surface calculation) */
  forgottenExports?: ExtractForgottenExport[];
  /** Type names to ignore in API surface calculation */
  apiSurfaceIgnore?: string[];
  /**
   * Export names from the package entry point.
   * When analyzing a sub-file, provide this to filter out false positive
   * "forgotten" exports that are actually exported from the main entry.
   */
  entryExportNames?: string[];
  /** Progress callback for long-running analysis */
  onProgress?: (current: number, total: number, item: string) => void;
  /**
   * Callback invoked after each export is analyzed.
   * Can be used for incremental persistence (crash recovery).
   */
  onExportAnalyzed?: (
    id: string,
    name: string,
    analysis: ExportAnalysis,
    index: number,
    total: number,
  ) => void | Promise<void>;
  /** Documentation style preset */
  style?: StylePreset;
  /** Custom documentation requirements (overrides preset) */
  require?: Partial<DocRequirements>;
}

/** Batch size for async yields during analysis */
const YIELD_BATCH_SIZE = 5;

/** Intermediate analysis result for a single export */
interface ExportAnalysisIntermediate {
  coverage: CoverageResult;
  drifts: DriftIssue[];
  exp: SpecExport;
}

/**
 * Build a Drift spec from an OpenPkg spec.
 *
 * @param options - Build options
 * @returns Drift specification with coverage analysis
 */
export async function buildDriftSpec(options: BuildDriftOptions): Promise<DriftSpec> {
  const {
    openpkg,
    openpkgPath,
    forgottenExports,
    apiSurfaceIgnore,
    entryExportNames,
    onProgress,
    onExportAnalyzed,
    style,
    require,
  } = options;
  const registry = buildExportRegistry(openpkg);

  // Resolve documentation requirements from style preset and custom overrides
  const requirements = resolveRequirements(style, require);

  // Filter out @internal exports - they're excluded from coverage/drift analysis
  const allExports = (openpkg.exports ?? []).filter((exp) => !hasInternalTag(exp));
  const total = allExports.length;

  // Phase 1: Analyze each export individually
  const analysisResults: ExportAnalysisIntermediate[] = [];

  for (let i = 0; i < total; i++) {
    const exp = allExports[i];

    // Report progress and yield to event loop periodically
    onProgress?.(i + 1, total, exp.name);
    if (i % YIELD_BATCH_SIZE === 0 && i > 0) {
      await new Promise((r) => setImmediate(r));
    }

    const coverage = computeExportCoverage(exp, requirements);
    const rawDrifts = computeExportDrift(exp, registry);
    const categorizedDrifts = rawDrifts.map((d) => toCategorizedDrift(d));

    analysisResults.push({ coverage, drifts: categorizedDrifts, exp });
  }

  // Phase 2: Group by name to handle overloads
  const byName = new Map<string, ExportAnalysisIntermediate[]>();
  for (const result of analysisResults) {
    const name = result.exp.name;
    const existing = byName.get(name) ?? [];
    existing.push(result);
    byName.set(name, existing);
  }

  // Phase 3: Build exports map, using best coverage across overloads
  const exports: Record<string, ExportAnalysis> = {};
  let totalScore = 0;
  let documentedCount = 0;
  const missingByRule: Record<MissingDocRule, number> = {
    description: 0,
    params: 0,
    returns: 0,
    examples: 0,
    throws: 0,
  };
  const driftByCategory: Record<DriftCategory, number> = {
    structural: 0,
    semantic: 0,
    example: 0,
  };
  let totalDrift = 0;
  let fixableDrift = 0;

  for (const [name, overloads] of byName) {
    // Find best coverage score across overloads (highest = most documented)
    const bestResult = overloads.reduce((best, curr) =>
      curr.coverage.score > best.coverage.score ? curr : best,
    );

    // Use ID from best result, fall back to name
    const exportId = bestResult.exp.id ?? name;

    // Collect all unique missing rules across overloads (union)
    // But if ANY overload is fully documented, it's considered documented
    const allMissing = new Set<MissingDocRule>();
    for (const r of overloads) {
      for (const m of r.coverage.missing) {
        allMissing.add(m);
      }
    }

    // Merge all drifts from all overloads
    const allDrifts: DriftIssue[] = [];
    for (const r of overloads) {
      allDrifts.push(...r.drifts);
    }

    const analysis: ExportAnalysis = {
      coverageScore: bestResult.coverage.score,
      missing: allMissing.size > 0 ? Array.from(allMissing) : undefined,
      drift: allDrifts.length > 0 ? allDrifts : undefined,
    };

    // Add overload count if > 1
    if (overloads.length > 1) {
      analysis.overloadCount = overloads.length;
    }

    exports[exportId] = analysis;

    // Invoke callback for incremental persistence
    if (onExportAnalyzed) {
      const idx = Object.keys(exports).length;
      await onExportAnalyzed(exportId, name, analysis, idx, byName.size);
    }

    // Count this grouped export once for summary stats
    totalScore += bestResult.coverage.score;
    if (isExportDocumented(bestResult.exp)) documentedCount++;

    // Count missing rules once per unique export (using best result)
    for (const rule of bestResult.coverage.missing) {
      missingByRule[rule]++;
    }

    // Count drifts from all overloads
    for (const d of allDrifts) {
      driftByCategory[d.category]++;
      totalDrift++;
      if (d.fixable) fixableDrift++;
    }
  }

  const exportCount = byName.size; // Count unique names, not individual overloads
  const coverageScore = exportCount > 0 ? Math.round(totalScore / exportCount) : 100;

  // Compute health score
  const health = computeHealth({
    coverageScore,
    documentedExports: documentedCount,
    totalExports: exportCount,
    missingByRule,
    driftIssues: totalDrift,
    fixableDrift,
    driftByCategory,
  });

  const summary: DriftSummary = {
    score: coverageScore,
    totalExports: exportCount,
    documentedExports: documentedCount,
    missingByRule,
    drift: {
      total: totalDrift,
      fixable: fixableDrift,
      byCategory: driftByCategory,
    },
    health,
  };

  // Compute API surface if forgotten exports provided
  const apiSurface = computeApiSurface(
    forgottenExports,
    openpkg.types?.length ?? 0,
    apiSurfaceIgnore,
    entryExportNames,
  );

  return {
    drift: '1.0.0',
    source: {
      file: openpkgPath,
      specVersion: openpkg.openpkg,
      packageName: openpkg.meta.name,
      packageVersion: openpkg.meta.version,
    },
    generatedAt: new Date().toISOString(),
    summary,
    exports,
    ...(apiSurface ? { apiSurface } : {}),
  };
}

/**
 * Compute API surface completeness from forgotten exports.
 */
function computeApiSurface(
  forgottenExports: ExtractForgottenExport[] | undefined,
  exportedTypesCount: number,
  ignoreList?: string[],
  entryExportNames?: string[],
): ApiSurfaceResult | undefined {
  if (!forgottenExports) return undefined;

  // Filter out ignored types
  const ignoreSet = new Set(ignoreList ?? []);

  // Filter out types that are exported from the package entry point
  // (relevant when analyzing sub-files, not the main entry)
  const entryExportSet = new Set(entryExportNames ?? []);

  const filteredExports = forgottenExports.filter(
    (f) => !ignoreSet.has(f.name) && !entryExportSet.has(f.name),
  );

  const forgotten: ForgottenExport[] = filteredExports.map((f) => ({
    name: f.name,
    definedIn: f.definedIn ? { file: f.definedIn } : undefined,
    referencedBy: f.referencedBy.map((r) => ({
      exportName: r.exportName,
      location: r.location,
    })),
    isExternal: f.isExternal,
    fix: f.fix ? { targetFile: f.definedIn ?? 'index.ts', exportStatement: f.fix } : undefined,
  }));

  const forgottenCount = forgotten.length;
  const totalReferenced = exportedTypesCount + forgottenCount;
  const completeness =
    totalReferenced > 0 ? Math.round((exportedTypesCount / totalReferenced) * 100) : 100;

  return {
    totalReferenced,
    exported: exportedTypesCount,
    forgotten,
    completeness,
  };
}

interface CoverageResult {
  score: number;
  missing: MissingDocRule[];
}

/**
 * Compute coverage score and missing rules for an export.
 *
 * @param exp - The export to analyze
 * @param requirements - Documentation requirements to enforce
 */
function computeExportCoverage(exp: SpecExport, requirements: DocRequirements): CoverageResult {
  const missing: MissingDocRule[] = [];
  let points = 0;
  let maxPoints = 0;

  // Description - weight based on requirement
  const descRequired = requirements.description;
  if (descRequired) {
    maxPoints += 30;
    if (exp.description && exp.description.trim().length > 0) {
      points += 30;
    } else {
      missing.push('description');
    }
  } else {
    // Still track as missing if not present, but no penalty
    if (!exp.description || exp.description.trim().length === 0) {
      missing.push('description');
    }
  }

  // Parameters (only for callables)
  const isCallable = exp.kind === 'function' || exp.kind === 'class';
  if (isCallable && exp.signatures?.length) {
    const sig = exp.signatures[0];
    const params = sig.parameters ?? [];
    if (params.length > 0) {
      const paramsRequired = requirements.params;
      if (paramsRequired) {
        maxPoints += 25;
      }
      const documentedParams = params.filter(
        (p) => p.description && p.description.trim().length > 0,
      );
      if (documentedParams.length === params.length) {
        if (paramsRequired) points += 25;
      } else if (documentedParams.length > 0) {
        if (paramsRequired) points += Math.round((documentedParams.length / params.length) * 25);
        missing.push('params');
      } else {
        missing.push('params');
      }
    }

    // Returns (only for functions)
    if (exp.kind === 'function' && sig.returns) {
      const returnsRequired = requirements.returns;
      if (returnsRequired) {
        maxPoints += 20;
      }
      if (sig.returns.description && sig.returns.description.trim().length > 0) {
        if (returnsRequired) points += 20;
      } else {
        missing.push('returns');
      }
    }

    // Throws (not configurable - always optional contribution)
    if (sig.throws && sig.throws.length > 0) {
      maxPoints += 10;
      const documentedThrows = sig.throws.filter((t) => t.description);
      if (documentedThrows.length === sig.throws.length) {
        points += 10;
      } else {
        missing.push('throws');
      }
    }
  }

  // Examples
  const examplesRequired = requirements.examples;
  if (examplesRequired) {
    maxPoints += 15;
  }
  if (exp.examples && exp.examples.length > 0) {
    if (examplesRequired) points += 15;
  } else {
    missing.push('examples');
  }

  // Handle 'types-only' preset: when no requirements, score is 100%
  const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 100;
  return { score, missing };
}

/**
 * Convert SDK drift to Drift issue with category and fixable flags.
 */
function toCategorizedDrift(drift: {
  type: string;
  target?: string;
  issue: string;
  suggestion?: string;
}): DriftIssue {
  const driftType = drift.type as DriftIssue['type'];
  const specDrift = { ...drift, type: driftType };
  return {
    type: driftType,
    target: drift.target,
    issue: drift.issue,
    suggestion: drift.suggestion,
    category: DRIFT_CATEGORIES[driftType],
    fixable: isFixableDrift(specDrift),
  };
}
