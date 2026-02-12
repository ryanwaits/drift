import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DriftSpec } from '@driftdev/spec';
import type { OpenPkg, SpecExport, SpecSignature, SpecType } from '@openpkg-ts/spec';
import {
  type CoverageSummary,
  type DriftReport,
  type ExportCoverageData,
  REPORT_VERSION,
} from '../types/report';
import { buildDriftSpec } from './drift-builder';
import { isExportDocumented } from './health';

/**
 * Generate a Drift report from an OpenPkg spec.
 *
 * @param spec - The pure OpenPkg spec to analyze
 * @param openpkgPath - Path to the openpkg spec file (for source tracking)
 * @returns A Drift report with coverage analysis
 *
 * @example
 * ```ts
 * import { Drift, generateReport } from '@driftdev/sdk';
 *
 * const drift = new Drift();
 * const { spec } = await drift.analyzeFileWithDiagnostics('src/index.ts');
 * const report = generateReport(spec);
 *
 * console.log(`Coverage: ${report.coverage.score}%`);
 * ```
 */
export async function generateReport(
  spec: OpenPkg,
  openpkgPath = 'openpkg.json',
): Promise<DriftReport> {
  const driftSpec = await buildDriftSpec({ openpkg: spec, openpkgPath });
  return generateReportFromDrift(spec, driftSpec);
}

/**
 * Generate a Drift report from OpenPkg spec + Drift spec composition.
 *
 * Use this when you've already called buildDriftSpec() and want to avoid
 * recomputing coverage data.
 *
 * @param openpkg - The pure OpenPkg spec
 * @param driftSpec - The Drift spec with analysis data
 * @returns A Drift report with coverage analysis
 */
export function generateReportFromDrift(openpkg: OpenPkg, driftSpec: DriftSpec): DriftReport {
  // Build per-export coverage data from driftSpec.exports (already handles overload grouping)
  const exportsData: Record<string, ExportCoverageData> = {};
  const missingByRule: Record<string, number> = {};

  // Build lookup from openpkg for name/kind info
  const openpkgExportsById = new Map<string, SpecExport>();
  for (const exp of openpkg.exports ?? []) {
    const id = exp.id ?? exp.name;
    // For overloads, first one wins (they all have same name/kind)
    if (!openpkgExportsById.has(id)) {
      openpkgExportsById.set(id, exp);
    }
  }

  let documentedExports = 0;
  let totalDrift = 0;

  // Iterate over driftSpec exports (grouped by name)
  for (const [exportId, analysis] of Object.entries(driftSpec.exports)) {
    const openpkgExp = openpkgExportsById.get(exportId);
    const data: ExportCoverageData = {
      name: openpkgExp?.name ?? exportId,
      kind: openpkgExp?.kind ?? 'unknown',
      coverageScore: analysis.coverageScore,
    };

    if (analysis.missing && analysis.missing.length > 0) {
      data.missing = analysis.missing;
      for (const ruleId of analysis.missing) {
        missingByRule[ruleId] = (missingByRule[ruleId] ?? 0) + 1;
      }
    }

    // Use isExportDocumented for consistent counting
    if (openpkgExp && isExportDocumented(openpkgExp)) {
      documentedExports++;
    }

    if (analysis.drift && analysis.drift.length > 0) {
      data.drift = analysis.drift;
      totalDrift += analysis.drift.length;
    }

    if (analysis.overloadCount && analysis.overloadCount > 1) {
      data.overloadCount = analysis.overloadCount;
    }

    exportsData[exportId] = data;
  }

  const coverage: CoverageSummary = {
    score: driftSpec.summary.score,
    totalExports: driftSpec.summary.totalExports,
    documentedExports,
    missingByRule,
    driftCount: totalDrift,
    driftSummary:
      driftSpec.summary.drift.total > 0
        ? {
            total: driftSpec.summary.drift.total,
            fixable: driftSpec.summary.drift.fixable,
            byCategory: driftSpec.summary.drift.byCategory,
          }
        : undefined,
  };

  return {
    $schema: 'https://drift.dev/schemas/v1.0.0/report.schema.json',
    version: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    spec: {
      name: openpkg.meta.name,
      version: openpkg.meta.version,
    },
    coverage,
    exports: exportsData,
    apiSurface: driftSpec.apiSurface,
  };
}

/**
 * Load a cached Drift report from disk.
 *
 * @param reportPath - Path to the report file
 * @returns The cached report, or null if not found
 */
export function loadCachedReport(reportPath: string): DriftReport | null {
  try {
    const fullPath = path.resolve(reportPath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as DriftReport;
  } catch {
    return null;
  }
}

/**
 * Save a Drift report to disk.
 *
 * @param report - The report to save
 * @param reportPath - Path to save the report
 */
export function saveReport(report: DriftReport, reportPath: string): void {
  const fullPath = path.resolve(reportPath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, JSON.stringify(report, null, 2));
}

// ============================================================================
// API Surface Renderer (git-trackable markdown format)
// ============================================================================

/**
 * Format a signature to a readable string.
 */
function formatSignature(name: string, signature: SpecSignature): string {
  const params = (signature.parameters ?? [])
    .map((p) => {
      const optional = p.required === false ? '?' : '';
      const rest = p.rest ? '...' : '';
      const typeStr =
        typeof p.schema === 'string'
          ? p.schema
          : ((p.schema as { type?: string })?.type ?? 'unknown');
      return `${rest}${p.name}${optional}: ${typeStr}`;
    })
    .join(', ');

  const returnType = signature.returns
    ? typeof signature.returns.schema === 'string'
      ? signature.returns.schema
      : ((signature.returns.schema as { type?: string })?.type ?? 'unknown')
    : 'void';

  const typeParams = signature.typeParameters?.length
    ? `<${signature.typeParameters.map((tp) => tp.name).join(', ')}>`
    : '';

  return `${name}${typeParams}(${params}): ${returnType}`;
}

/**
 * Format an export to API surface markdown.
 */
function formatExportToApiSurface(exp: SpecExport): string {
  const lines: string[] = [];
  lines.push(`### ${exp.name}`);

  switch (exp.kind) {
    case 'function': {
      const signatures = exp.signatures ?? [];
      if (signatures.length === 0) {
        lines.push(`\`\`\`typescript\nfunction ${exp.name}(): unknown\n\`\`\``);
      } else {
        for (const sig of signatures) {
          lines.push(`\`\`\`typescript\nfunction ${formatSignature(exp.name, sig)}\n\`\`\``);
        }
      }
      break;
    }
    case 'class': {
      const extendsClause = exp.extends ? ` extends ${exp.extends}` : '';
      const implementsClause = exp.implements?.length
        ? ` implements ${exp.implements.join(', ')}`
        : '';
      lines.push(`\`\`\`typescript\nclass ${exp.name}${extendsClause}${implementsClause}\n\`\`\``);
      break;
    }
    case 'interface':
    case 'type': {
      const typeStr =
        typeof exp.type === 'string'
          ? exp.type
          : ((exp.type as { type?: string })?.type ?? '{ ... }');
      lines.push(`\`\`\`typescript\ntype ${exp.name} = ${typeStr}\n\`\`\``);
      break;
    }
    case 'variable': {
      const typeStr =
        typeof exp.type === 'string'
          ? exp.type
          : ((exp.type as { type?: string })?.type ?? 'unknown');
      lines.push(`\`\`\`typescript\nconst ${exp.name}: ${typeStr}\n\`\`\``);
      break;
    }
    case 'enum': {
      lines.push(`\`\`\`typescript\nenum ${exp.name} { ... }\n\`\`\``);
      break;
    }
    default: {
      lines.push(`\`\`\`typescript\n${exp.kind} ${exp.name}\n\`\`\``);
    }
  }

  return lines.join('\n');
}

/**
 * Format a type to API surface markdown.
 */
function formatTypeToApiSurface(type: SpecType): string {
  const lines: string[] = [];
  lines.push(`### ${type.name}`);

  switch (type.kind) {
    case 'interface': {
      const extendsClause = type.extends ? ` extends ${type.extends}` : '';
      lines.push(`\`\`\`typescript\ninterface ${type.name}${extendsClause} { ... }\n\`\`\``);
      break;
    }
    case 'type': {
      const typeStr =
        typeof type.type === 'string'
          ? type.type
          : ((type.type as { type?: string })?.type ?? '{ ... }');
      lines.push(`\`\`\`typescript\ntype ${type.name} = ${typeStr}\n\`\`\``);
      break;
    }
    case 'class': {
      const extendsClause = type.extends ? ` extends ${type.extends}` : '';
      lines.push(`\`\`\`typescript\nclass ${type.name}${extendsClause}\n\`\`\``);
      break;
    }
    case 'enum': {
      lines.push(`\`\`\`typescript\nenum ${type.name} { ... }\n\`\`\``);
      break;
    }
    default: {
      lines.push(`\`\`\`typescript\n${type.kind} ${type.name}\n\`\`\``);
    }
  }

  return lines.join('\n');
}

/**
 * Generate a git-trackable API surface markdown file from an OpenPkg spec.
 *
 * This produces a deterministic, sorted output suitable for version control.
 * Changes to the API will show up as diffs in this file.
 *
 * @param spec - The OpenPkg spec to render
 * @returns Markdown string representing the API surface
 *
 * @example
 * ```ts
 * import { Drift, renderApiSurface } from '@driftdev/sdk';
 *
 * const drift = new Drift();
 * const { spec } = await drift.analyzeFileWithDiagnostics('src/index.ts');
 * const apiSurface = renderApiSurface(spec);
 *
 * fs.writeFileSync('api-surface.md', apiSurface);
 * ```
 */
export function renderApiSurface(spec: OpenPkg): string {
  const lines: string[] = [];

  // Header
  const version = spec.meta.version ? ` v${spec.meta.version}` : '';
  lines.push(`# API Surface: ${spec.meta.name}${version}`);
  lines.push('');
  lines.push('> This file is auto-generated. Do not edit manually.');
  lines.push('> Run `drift spec --format api-surface` to regenerate.');
  lines.push('');

  // Group exports by kind and sort alphabetically
  const exportsByKind: Record<string, SpecExport[]> = {};
  for (const exp of spec.exports) {
    const kind = exp.kind;
    if (!exportsByKind[kind]) {
      exportsByKind[kind] = [];
    }
    exportsByKind[kind].push(exp);
  }

  // Sort each group alphabetically
  for (const kind of Object.keys(exportsByKind)) {
    exportsByKind[kind].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Render in a consistent order
  const kindOrder = [
    'function',
    'class',
    'interface',
    'type',
    'variable',
    'enum',
    'namespace',
    'module',
  ];

  for (const kind of kindOrder) {
    const exports = exportsByKind[kind];
    if (!exports || exports.length === 0) continue;

    const kindTitle = `${kind.charAt(0).toUpperCase() + kind.slice(1)}s`;
    lines.push(`## ${kindTitle}`);
    lines.push('');

    for (const exp of exports) {
      lines.push(formatExportToApiSurface(exp));
      lines.push('');
    }
  }

  // Handle any remaining kinds not in the order list
  for (const kind of Object.keys(exportsByKind).sort()) {
    if (kindOrder.includes(kind)) continue;
    const exports = exportsByKind[kind];
    if (!exports || exports.length === 0) continue;

    const kindTitle = `${kind.charAt(0).toUpperCase() + kind.slice(1)}s`;
    lines.push(`## ${kindTitle}`);
    lines.push('');

    for (const exp of exports) {
      lines.push(formatExportToApiSurface(exp));
      lines.push('');
    }
  }

  // Render types section if there are types
  const types = spec.types ?? [];
  if (types.length > 0) {
    // Sort types alphabetically
    const sortedTypes = [...types].sort((a, b) => a.name.localeCompare(b.name));

    lines.push('## Internal Types');
    lines.push('');

    for (const type of sortedTypes) {
      lines.push(formatTypeToApiSurface(type));
      lines.push('');
    }
  }

  return lines.join('\n');
}
