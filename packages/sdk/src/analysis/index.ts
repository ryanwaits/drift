/**
 * Analysis utilities for drift detection, coverage, and reporting.
 *
 * @example
 * ```ts
 * import { computeDrift, buildDocCovSpec, generateReport } from '@doccov/sdk/analysis';
 * ```
 *
 * @module analysis
 */

// Context types
export type { DetectedSchemaEntry } from './context';
// DocCov spec builder
export {
  type BuildDocCovOptions,
  buildDocCovSpec,
  type ExtractForgottenExport,
} from './doccov-builder';
// Drift detection and categorization
export {
  buildExportRegistry,
  type CategorizedDrift,
  calculateAggregateCoverage,
  categorizeDrift,
  computeDrift,
  computeExportDrift,
  type DriftResult,
  type DriftSummary,
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  type ExportDriftResult,
  ensureSpecCoverage,
  formatDriftSummaryLine,
  getDriftSummary,
  groupDriftsByCategory,
  hasNonAssertionComments,
  parseAssertions,
} from './docs-coverage';
// History and trends
export {
  type CoverageSnapshot,
  type CoverageTrend,
  computeSnapshot,
  type ExtendedTrendAnalysis,
  formatDelta,
  generateWeeklySummaries,
  getExtendedTrend,
  getTrend,
  HISTORY_DIR,
  loadSnapshots,
  loadSnapshotsForDays,
  pruneHistory,
  renderSparkline,
  saveSnapshot,
  type WeeklySummary,
} from './history';
// Lookup helpers for composition pattern
export {
  getExportAnalysis,
  getExportDrift,
  getExportMissing,
  getExportScore,
  isExportFullyDocumented,
} from './lookup';

// Module graph for cross-module @link validation
export type { ModuleGraph, ModuleInfo } from './module-graph';
export { buildModuleGraph, findSymbolModule, symbolExistsInGraph } from './module-graph';

// Report generation
export {
  generateReport,
  generateReportFromDocCov,
  isCachedReportValid,
  loadCachedReport,
  renderApiSurface,
  saveReport,
} from './report';

// Schema detection
export {
  detectRuntimeSchemas,
  type SchemaDetectionContext,
  type SchemaDetectionResult,
} from './schema-detection';

// Spec types
export type { OpenPkgSpec } from './spec-types';

// Incremental analysis for crash recovery
export {
  cleanupOrphanedTempFiles,
  findOrphanedTempFiles,
  IncrementalAnalyzer,
  type IncrementalAnalyzerOptions,
  type IncrementalExportResult,
  type PartialAnalysisState,
} from './incremental';
