import type {
  ApiSurfaceResult,
  DocCovDrift,
  DocCovSpec,
  DocCovSummary,
  DriftCategory,
  ExportAnalysis,
  ForgottenExport,
  MissingDocRule,
  TypeReferenceLocation,
} from '@doccov/spec';
import { DRIFT_CATEGORIES } from '@doccov/spec';
import type { SpecExport } from '@openpkg-ts/spec';
import { isFixableDrift } from '../fix';
import { buildExportRegistry, computeExportDrift } from './drift/compute';
import type { OpenPkgSpec } from './spec-types';

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

export interface BuildDocCovOptions {
  openpkgPath: string;
  openpkg: OpenPkgSpec;
  packagePath?: string;
  /** Forgotten exports from extraction (for API surface calculation) */
  forgottenExports?: ExtractForgottenExport[];
  /** Type names to ignore in API surface calculation */
  apiSurfaceIgnore?: string[];
}

/**
 * Build a DocCov spec from an OpenPkg spec.
 *
 * @param options - Build options
 * @returns DocCov specification with coverage analysis
 */
export function buildDocCovSpec(options: BuildDocCovOptions): DocCovSpec {
  const { openpkg, openpkgPath, forgottenExports, apiSurfaceIgnore } = options;
  const registry = buildExportRegistry(openpkg);

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

  for (const exp of openpkg.exports ?? []) {
    const coverage = computeExportCoverage(exp);
    const rawDrifts = computeExportDrift(exp, registry);
    const categorizedDrifts = rawDrifts.map((d) => toCategorizedDrift(d));

    const exportId = exp.id ?? exp.name;
    exports[exportId] = {
      coverageScore: coverage.score,
      missing: coverage.missing.length > 0 ? coverage.missing : undefined,
      drift: categorizedDrifts.length > 0 ? categorizedDrifts : undefined,
    };

    totalScore += coverage.score;
    if (coverage.score === 100) documentedCount++;

    for (const rule of coverage.missing) {
      missingByRule[rule]++;
    }

    for (const d of categorizedDrifts) {
      driftByCategory[d.category]++;
      totalDrift++;
      if (d.fixable) fixableDrift++;
    }
  }

  const exportCount = openpkg.exports?.length ?? 0;
  const summary: DocCovSummary = {
    score: exportCount > 0 ? Math.round(totalScore / exportCount) : 100,
    totalExports: exportCount,
    documentedExports: documentedCount,
    missingByRule,
    drift: {
      total: totalDrift,
      fixable: fixableDrift,
      byCategory: driftByCategory,
    },
  };

  // Compute API surface if forgotten exports provided
  const apiSurface = computeApiSurface(
    forgottenExports,
    openpkg.types?.length ?? 0,
    apiSurfaceIgnore,
  );

  return {
    doccov: '1.0.0',
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
): ApiSurfaceResult | undefined {
  if (!forgottenExports) return undefined;

  // Filter out ignored types
  const ignoreSet = new Set(ignoreList ?? []);
  const filteredExports = forgottenExports.filter((f) => !ignoreSet.has(f.name));

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
 */
function computeExportCoverage(exp: SpecExport): CoverageResult {
  const missing: MissingDocRule[] = [];
  let points = 0;
  let maxPoints = 0;

  // Description (required for all exports)
  maxPoints += 30;
  if (exp.description && exp.description.trim().length > 0) {
    points += 30;
  } else {
    missing.push('description');
  }

  // Parameters (only for callables)
  const isCallable = exp.kind === 'function' || exp.kind === 'class';
  if (isCallable && exp.signatures?.length) {
    const sig = exp.signatures[0];
    const params = sig.parameters ?? [];
    if (params.length > 0) {
      maxPoints += 25;
      const documentedParams = params.filter(
        (p) => p.description && p.description.trim().length > 0,
      );
      if (documentedParams.length === params.length) {
        points += 25;
      } else if (documentedParams.length > 0) {
        points += Math.round((documentedParams.length / params.length) * 25);
        missing.push('params');
      } else {
        missing.push('params');
      }
    }

    // Returns (only for functions)
    if (exp.kind === 'function' && sig.returns) {
      maxPoints += 20;
      if (sig.returns.description && sig.returns.description.trim().length > 0) {
        points += 20;
      } else {
        missing.push('returns');
      }
    }

    // Throws
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

  // Examples (always check)
  maxPoints += 15;
  if (exp.examples && exp.examples.length > 0) {
    points += 15;
  } else {
    missing.push('examples');
  }

  const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 100;
  return { score, missing };
}

/**
 * Convert SDK drift to DocCov drift with category and fixable flags.
 */
function toCategorizedDrift(drift: {
  type: string;
  target?: string;
  issue: string;
  suggestion?: string;
}): DocCovDrift {
  const driftType = drift.type as DocCovDrift['type'];
  return {
    type: driftType,
    target: drift.target,
    issue: drift.issue,
    suggestion: drift.suggestion,
    category: DRIFT_CATEGORIES[driftType],
    fixable: isFixableDrift(drift as { type: string }),
  };
}
