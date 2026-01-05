import type { ApiSurfaceResult, DocumentationHealth } from '@doccov/spec';
import type { CategorizedDrift, DriftCategory, SpecDocDrift } from '../analysis/drift/types';

/**
 * DocCov report schema version.
 */
export const REPORT_VERSION = '1.0.0';

/**
 * Default directory for DocCov outputs.
 */
export const DEFAULT_REPORT_DIR = '.doccov';

/**
 * Default path for cached DocCov reports.
 */
export const DEFAULT_REPORT_PATH = '.doccov/report.json';

/**
 * File extensions for each report format.
 */
export const REPORT_EXTENSIONS: Record<string, string> = {
  json: 'json',
  markdown: 'md',
  html: 'html',
  github: 'github.md',
};

/**
 * Get the default report path for a given format.
 *
 * @param format - The report format (json, markdown, html, github)
 * @param dir - The output directory (defaults to .doccov)
 * @returns The full path to the report file
 *
 * @example
 * ```ts
 * getReportPath('markdown'); // '.doccov/report.md'
 * getReportPath('html', 'reports'); // 'reports/report.html'
 * ```
 */
export function getReportPath(format: string, dir: string = DEFAULT_REPORT_DIR): string {
  const ext = REPORT_EXTENSIONS[format] ?? format;
  return `${dir}/report.${ext}`;
}

/**
 * Get the report path for a diff comparison.
 *
 * Uses truncated hashes from both specs to create a unique, deterministic filename.
 *
 * @param baseHash - Hash of the base (before) spec
 * @param headHash - Hash of the head (after) spec
 * @param format - The report format (json, markdown, html, github)
 * @param dir - The output directory (defaults to .doccov)
 * @returns The full path to the diff report file
 *
 * @example
 * ```ts
 * getDiffReportPath('abc123def456', 'xyz789uvw012', 'markdown');
 * // '.doccov/diff-abc123de-xyz789uv.md'
 * ```
 */
export function getDiffReportPath(
  baseHash: string,
  headHash: string,
  format: string,
  dir: string = DEFAULT_REPORT_DIR,
): string {
  const ext = REPORT_EXTENSIONS[format] ?? format;
  const hash = `${baseHash.slice(0, 8)}-${headHash.slice(0, 8)}`;
  return `${dir}/diff-${hash}.${ext}`;
}

/**
 * Drift summary with category breakdown.
 */
export interface DriftReportSummary {
  /**
   * Total number of drift issues.
   */
  total: number;

  /**
   * Count of issues per category.
   */
  byCategory: Record<DriftCategory, number>;

  /**
   * Number of auto-fixable issues.
   */
  fixable: number;
}

/**
 * Drift report with progressive disclosure structure.
 *
 * Provides three levels of detail:
 * 1. Summary - total counts by category
 * 2. By category - grouped drift issues
 * 3. All - flat list for backward compatibility
 */
export interface DriftReport {
  /**
   * High-level summary counts.
   */
  summary: DriftReportSummary;

  /**
   * Issues grouped by category.
   */
  byCategory: Record<DriftCategory, CategorizedDrift[]>;

  /**
   * Flat list of all drift issues (backward compatible).
   */
  all: CategorizedDrift[];
}

/**
 * Coverage summary for an entire package or project.
 */
export interface CoverageSummary {
  /**
   * Overall coverage score (0-100).
   */
  score: number;

  /**
   * Total number of exports analyzed.
   */
  totalExports: number;

  /**
   * Number of fully documented exports.
   */
  documentedExports: number;

  /**
   * Breakdown of missing documentation by rule ID.
   */
  missingByRule: Record<string, number>;

  /**
   * Total number of drift issues detected.
   */
  driftCount: number;

  /**
   * Drift summary with category breakdown.
   */
  driftSummary?: DriftReportSummary;
}

/**
 * Coverage data for a single export.
 */
export interface ExportCoverageData {
  /**
   * Export name.
   */
  name: string;

  /**
   * Export kind (function, class, etc.).
   */
  kind: string;

  /**
   * Coverage score for this export (0-100).
   */
  coverageScore: number;

  /**
   * Missing documentation rule IDs.
   */
  missing?: string[];

  /**
   * Drift issues for this export.
   */
  drift?: SpecDocDrift[];
}

/**
 * DocCov report - a persistable coverage analysis result.
 *
 * This is the format saved to `.doccov/report.json` and returned
 * by the `check` command with `--format json`.
 */
export interface DocCovReport {
  /**
   * JSON Schema reference for validation.
   */
  $schema: string;

  /**
   * Report format version.
   */
  version: string;

  /**
   * ISO 8601 timestamp when report was generated.
   */
  generatedAt: string;

  /**
   * Package/project metadata.
   */
  spec: {
    name: string;
    version?: string;
  };

  /**
   * Aggregate coverage summary.
   */
  coverage: CoverageSummary;

  /**
   * Per-export coverage data, keyed by export ID.
   */
  exports: Record<string, ExportCoverageData>;

  /**
   * API surface analysis (forgotten exports).
   */
  apiSurface?: ApiSurfaceResult;

  /**
   * Unified documentation health score.
   */
  health?: DocumentationHealth;
}
