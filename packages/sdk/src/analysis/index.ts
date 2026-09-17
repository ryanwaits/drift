/**
 * Analysis utilities for drift detection, coverage, and reporting.
 *
 * @example
 * ```ts
 * import { computeDrift, buildDriftSpec, generateReport } from '@driftdev/sdk/analysis';
 * ```
 *
 * @module analysis
 */

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
// Prose drift detection
export { detectProseDrift, type ProseDriftOptions } from './drift/prose-drift';
// Context types
// Drift spec builder
export {
  type BuildDriftOptions,
  buildDriftSpec,
  type ExtractForgottenExport,
} from './drift-builder';
export type {
  DocsKeyCorpus,
  DocumentedKeyLocation,
  KeyAnnotation,
  KeyCoverageOptions,
  KeyCoverageResult,
  KeyGap,
  KeyGhost,
  KeyInversion,
  KeyMeta,
} from './key-coverage';
export {
  collectAllTypeKeys,
  collectTypeKeys,
  computeKeyCoverage,
  DEFAULT_SECTION_RE,
  extractDocumentedKeys,
  findTypeEntry,
  parseReplacement,
} from './key-coverage';
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
  generateReportFromDrift,
  loadCachedReport,
  renderApiSurface,
  saveReport,
} from './report';
// Spec types
export type { OpenPkgSpec } from './spec-types';
