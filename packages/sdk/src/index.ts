/**
 * Drift SDK — embed the same check as `drift` / `drift get` / `drift list`.
 *
 * @example
 * ```ts
 * import { Drift, computeDrift, detectProseDrift, buildPageDocument } from '@driftdev/sdk';
 * import { discoverMarkdownFiles } from '@driftdev/sdk/markdown';
 * import { validateExamples } from '@driftdev/sdk/examples';
 * ```
 *
 * @module @driftdev/sdk
 */

// Drift detection
export type {
  CategorizedDrift,
  DriftCategory,
  DriftResult,
  DriftSummary,
  DriftType,
  ExportRegistry,
  SpecDocDrift,
} from './analysis/docs-coverage';
export {
  buildExportRegistry,
  computeDrift,
  computeExportDrift,
  DRIFT_CATEGORIES,
  DRIFT_CATEGORY_DESCRIPTIONS,
  DRIFT_CATEGORY_LABELS,
} from './analysis/docs-coverage';
// Coverage helpers
export {
  EXTERNAL_SOURCE_FILE,
  isExportDocumented,
  isExternalExport,
} from './analysis/documented';
export type { ComputeDriftOptions } from './analysis/drift/compute';
// Markdown — prefer @driftdev/sdk/markdown
export { detectProseDrift, type ProseDriftOptions } from './analysis/drift/prose-drift';
export type { BuildDriftOptions } from './analysis/drift-builder';
export { buildDriftSpec } from './analysis/drift-builder';
// Key coverage (option tables vs spec types)
export type {
  DocsKeyCorpus,
  KeyAnnotation,
  KeyCoverageOptions,
  KeyCoverageResult,
  KeyGap,
  KeyGhost,
  KeyInversion,
} from './analysis/key-coverage';
export {
  collectAllTypeKeys,
  collectTypeKeys,
  computeKeyCoverage,
  DEFAULT_SECTION_RE,
  extractDocumentedKeys,
  findTypeEntry,
} from './analysis/key-coverage';
export { generateReport, renderApiSurface } from './analysis/report';
// Analyzer
export type {
  AnalysisResult,
  AnalyzeOptions,
  Diagnostic,
  ScanOptions,
} from './analyzer';
export { analyze, analyzeFile, Drift, scan } from './analyzer';

// Config
export type {
  CoverageConfig,
  DocsConfig,
  DriftConfig,
  DriftConfigInput,
} from './config';
export { defineConfig, driftConfigSchema, normalizeConfig } from './config';

// Project resolution
export type { FileSystem, PackageJson, PackageManager, ProjectInfo } from './detect';
export { analyzeProject, detectPackageManager, NodeFileSystem } from './detect';
// Examples — prefer @driftdev/sdk/examples
export type { ExampleValidation } from './examples/types';
export { parseExamplesFlag } from './examples/types';
export type {
  ExampleValidationOptions,
  ExampleValidationResult,
} from './examples/validator';
export { validateExamples } from './examples/validator';
export { discoverMarkdownFiles } from './markdown/discover';
export { findExportReferences, parseMarkdownFiles } from './markdown/parser';
export type { MarkdownCodeBlock, MarkdownDocFile } from './markdown/types';
export type { DriftOptions } from './options';
export type {
  BuildPageDocumentOptions,
  BuildPageDocumentsOptions,
  Claim,
  ClaimKind,
  Locator,
  PageDocsMap,
  PageDocsMapPage,
  PageDocument,
  RuleHit,
  SourcePos,
  SpecRef,
  SpecSlice,
} from './page';
export { buildPageDocument, buildPageDocuments } from './page';
export type { ResolvedTarget, ResolveTargetOptions } from './resolve';
export { resolveTarget } from './resolve';
export type { ExampleTypeError, TypecheckResult } from './typecheck';
export { typecheckExamples } from './typecheck';
export type { CoverageSummary, DriftReport, ExportCoverageData } from './types/report';
