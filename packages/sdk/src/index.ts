/**
 * DocCov SDK - Documentation coverage and drift detection for TypeScript.
 *
 * This is the main entry point with core functionality.
 * For specialized utilities, use subpath imports:
 *
 * @example
 * ```ts
 * // Core API (this module)
 * import { DocCov, buildDocCovSpec, computeDrift } from '@driftdev/sdk';
 *
 * // Analysis utilities
 * import { generateReport, computeSnapshot } from '@driftdev/sdk/analysis';
 *
 * // Type definitions
 * import type { DocCovReport, FilterOptions } from '@driftdev/sdk/types';
 * ```
 *
 * @module @driftdev/sdk
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Analysis API
// ─────────────────────────────────────────────────────────────────────────────

export type { BuildDocCovOptions } from './analysis/doccov-builder';
// DocCov spec builder
export { buildDocCovSpec } from './analysis/doccov-builder';
export type {
  CategorizedDrift,
  DriftCategory,
  DriftResult,
  DriftSummary,
  DriftType,
  SpecDocDrift,
} from './analysis/docs-coverage';
// Drift detection (most commonly used)
export {
  buildExportRegistry,
  computeDrift,
  computeExportDrift,
  DRIFT_CATEGORIES,
  DRIFT_CATEGORY_DESCRIPTIONS,
  DRIFT_CATEGORY_LABELS,
} from './analysis/docs-coverage';
// Health computation
export type { HealthInput } from './analysis/health';
export { computeHealth, isExportDocumented } from './analysis/health';
// Lookup helpers (for composition pattern)
export {
  getExportAnalysis,
  getExportDrift,
  getExportMissing,
  getExportScore,
  isExportFullyDocumented,
} from './analysis/lookup';
// Report generation
export { generateReport, renderApiSurface } from './analysis/report';
// Batch analysis
export type { BatchResult, PackageResult } from './analysis/batch';
export { aggregateResults, createPackageResult } from './analysis/batch';
// Module graph for cross-module @link validation
export type { ModuleGraph, ModuleInfo } from './analysis/module-graph';
export { buildModuleGraph, findSymbolModule, symbolExistsInGraph } from './analysis/module-graph';
// Drift options
export type { ComputeDriftOptions } from './analysis/drift/compute';
// Spec types
export type { OpenPkgSpec } from './analysis/spec-types';
// Incremental analysis (crash recovery)
export type {
  IncrementalAnalyzerOptions,
  IncrementalExportResult,
  PartialAnalysisState,
} from './analysis/incremental';
export {
  cleanupOrphanedTempFiles,
  findOrphanedTempFiles,
  IncrementalAnalyzer,
} from './analysis/incremental';
export type { AnalysisResult, AnalyzeOptions, Diagnostic, ForgottenExportResult } from './analyzer';
export { analyze, analyzeFile, DocCov } from './analyzer';
export type { DocCovOptions } from './options';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export type {
  DocCovConfig,
  DocCovConfigInput,
  DocsConfig,
} from './config';
export { defineConfig, docCovConfigSchema, normalizeConfig } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Project Resolution & Detection
// ─────────────────────────────────────────────────────────────────────────────

export type { FileSystem, PackageJson, PackageManager, ProjectInfo } from './detect';
export { analyzeProject, detectPackageManager, NodeFileSystem } from './detect';
export type { ResolvedTarget, ResolveTargetOptions } from './resolve';
export { resolveTarget } from './resolve';

// ─────────────────────────────────────────────────────────────────────────────
// Example Validation
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ExampleValidation,
  ExampleValidationOptions,
  ExampleValidationResult,
} from './examples';
export { parseExamplesFlag, validateExamples } from './examples';

// ─────────────────────────────────────────────────────────────────────────────
// Fix Utilities
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ApplyForgottenExportResult,
  FixSuggestion,
  ForgottenExportFix,
  GenerateForgottenExportFixesOptions,
  JSDocEdit,
  JSDocPatch,
} from './fix';
export {
  applyEdits,
  applyForgottenExportFixes,
  categorizeDrifts,
  createSourceFile,
  findJSDocLocation,
  generateFixesForExport,
  generateForgottenExportFixes,
  groupFixesByFile,
  isFixableDrift,
  mergeFixes,
  parseJSDocToPatch,
  previewForgottenExportFixes,
  serializeJSDoc,
} from './fix';

// ─────────────────────────────────────────────────────────────────────────────
// Markdown Analysis
// ─────────────────────────────────────────────────────────────────────────────

export type { MarkdownCodeBlock, MarkdownDocFile } from './markdown';
export { discoverMarkdownFiles, findExportReferences, parseMarkdownFiles } from './markdown';
export { detectProseDrift, type ProseDriftOptions } from './analysis/drift/prose-drift';

// ─────────────────────────────────────────────────────────────────────────────
// Report Types (commonly needed)
// ─────────────────────────────────────────────────────────────────────────────

export type { CoverageSummary, DocCovReport, ExportCoverageData } from './types/report';

// ─────────────────────────────────────────────────────────────────────────────
// Filter Types (commonly needed)
// ─────────────────────────────────────────────────────────────────────────────

export type { FilterOptions, ReleaseTag } from './filtering/types';

// ─────────────────────────────────────────────────────────────────────────────
// Typecheck
// ─────────────────────────────────────────────────────────────────────────────

export type { ExampleTypeError, TypecheckResult } from './typecheck';
export { typecheckExamples } from './typecheck';

// ─────────────────────────────────────────────────────────────────────────────
// Additional Exports (re-exported from submodules for convenience)
// ─────────────────────────────────────────────────────────────────────────────

// Context types
export type { ExportDriftResult } from './analysis/docs-coverage';
// Analysis (migrate to @driftdev/sdk/analysis)
export {
  calculateAggregateCoverage,
  categorizeDrift,
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  ensureSpecCoverage,
  formatDriftSummaryLine,
  getDriftSummary,
  groupDriftsByCategory,
  hasNonAssertionComments,
  parseAssertions,
} from './analysis/docs-coverage';
export type {
  CoverageSnapshot,
  CoverageTrend,
  ExtendedTrendAnalysis,
} from './analysis/history';
export {
  computeSnapshot,
  formatDelta,
  getExtendedTrend,
  getTrend,
  HISTORY_DIR,
  loadSnapshots,
  pruneHistory,
  renderSparkline,
  saveSnapshot,
} from './analysis/history';
export { generateReportFromDocCov, loadCachedReport, saveReport } from './analysis/report';
export type { CacheContext, CacheValidationResult, SpecCache, SpecCacheConfig } from './cache';
// Cache (for advanced usage)
export {
  CACHE_VERSION,
  clearSpecCache,
  diffHashes,
  getSpecCachePath,
  hashFile,
  hashFiles,
  hashString,
  loadSpecCache,
  SPEC_CACHE_FILE,
  saveSpecCache,
  validateSpecCache,
} from './cache';
// Config types (additional)
export type { ExampleValidationMode } from './config';
export type {
  AnalyzeProjectOptions,
  BuildInfo,
  EntryPointInfo,
  EntryPointSource,
  MonorepoInfo,
  MonorepoType,
  PackageExports,
  PackageManagerInfo,
  WorkspacePackage,
} from './detect';
// Detection (for advanced usage)
export {
  detectBuildInfo,
  detectEntryPoint,
  detectMonorepo,
  findEntryPointForFile,
  findPackageByName,
  formatPackageList,
  getInstallCommand,
  getPrimaryBuildScript,
  getRunCommand,
  isPackageEntryPoint,
  readPackageJson,
  SandboxFileSystem,
  safeParseJson,
} from './detect';
export type {
  ExampleValidationTypeError,
  LLMAssertion,
  PresenceResult,
  RuntimeDrift,
  RunValidationResult,
  TypecheckValidationResult,
} from './examples';

// Examples (additional exports)
export { ALL_VALIDATIONS, shouldValidate, VALIDATION_INFO } from './examples';
export { extractPackageSpec } from './extractor';
export type { FilterSource, ResolvedFilters } from './filtering/merge';
// Filtering
export { mergeFilters, parseListFlag } from './filtering/merge';
export type { ApplyEditsResult, FixType, JSDocParam, JSDocReturn, JSDocTag } from './fix';
// Fix (additional exports)
export { applyPatchToJSDoc, generateFix } from './fix';
export type { ParsedGitHubUrl } from './github';
// GitHub
export { parseGitHubUrl } from './github';
export type { CommandResult, CommandRunner, InstallOptions, InstallResult } from './install';
// Install
export { createNodeCommandRunner, installDependencies } from './install';
export type {
  DiffWithDocsOptions,
  DocsChangeType,
  DocsImpact,
  DocsImpactReference,
  DocsImpactResult,
  ExportReference,
  MemberChange,
  SpecDiffWithDocs,
} from './markdown';
// Markdown (additional exports)
export {
  analyzeDocsImpact,
  blockReferencesExport,
  diffSpecWithDocs,
  extractFunctionCalls,
  extractImports,
  findDeprecatedReferences,
  findRemovedReferences,
  getDocsImpactSummary,
  getDocumentedExports,
  getUndocumentedExports,
  hasDocsForExport,
  hasDocsImpact,
  isExecutableLang,
  parseMarkdownFile,
} from './markdown';
export type {
  BuildHints,
  BuildPlan,
  BuildPlanEnvironment,
  BuildPlanExecutionResult,
  BuildPlanStep,
  BuildPlanStepResult,
  BuildPlanTarget,
  DetectedPackageManager,
  FetchGitHubContextOptions,
  GitHubProjectContext,
  GitHubRepoMetadata,
  SpecSummary,
  SummaryDriftIssue,
  WorkspaceConfig,
} from './scan';
// Scan
export {
  extractSpecSummary,
  fetchGitHubContext,
  listWorkspacePackages,
  parseGitHubUrl as parseScanGitHubUrl,
} from './scan';
export type { TypecheckOptions } from './typecheck';
// Typecheck (additional exports)
export { typecheckExample } from './typecheck';
export type { DriftReport, DriftReportSummary } from './types/report';
// Report types (additional exports)
export {
  getDiffReportPath,
  getReportPath,
  REPORT_EXTENSIONS,
  REPORT_VERSION,
} from './types/report';
export type {
  ExampleRunResult,
  RunExampleOptions,
  RunExamplesWithPackageOptions,
  RunExamplesWithPackageResult,
} from './utils/example-runner';
// Example runner
export { runExample, runExamples, runExamplesWithPackage } from './utils/example-runner';
// Project root detection
export { findProjectRoot, getDriftdevDir, getStateDir, _setStateDirOverride } from './utils/project-root';
