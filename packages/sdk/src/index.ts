/**
 * DocCov SDK - Documentation coverage and drift detection for TypeScript.
 *
 * This is the main entry point with core functionality.
 * For specialized utilities, use subpath imports:
 *
 * @example
 * ```ts
 * // Core API (this module)
 * import { DocCov, buildDocCovSpec, computeDrift } from '@doccov/sdk';
 *
 * // Analysis utilities
 * import { generateReport, computeSnapshot } from '@doccov/sdk/analysis';
 *
 * // Type definitions
 * import type { DocCovReport, FilterOptions } from '@doccov/sdk/types';
 * ```
 *
 * @module @doccov/sdk
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Analysis API
// ─────────────────────────────────────────────────────────────────────────────

// Health computation
export type { HealthInput } from './analysis/health';
export { computeHealth } from './analysis/health';

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
// Spec types
export type { OpenPkgSpec } from './analysis/spec-types';
export type { AnalysisResult, AnalyzeOptions, Diagnostic, ForgottenExportResult } from './openpkg';
export { analyze, analyzeFile, DocCov } from './openpkg';
export type { DocCovOptions } from './options';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export type { CheckConfig, DocCovConfig, DocsConfig } from './config';
export { defineConfig } from './config';

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
export { findExportReferences, parseMarkdownFiles } from './markdown';

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
export type { DetectedSchemaEntry } from './analysis/context';
export type { ExportDriftResult } from './analysis/docs-coverage';
// Analysis (migrate to @doccov/sdk/analysis)
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
  RetentionTier,
} from './analysis/history';
export {
  computeSnapshot,
  formatDelta,
  getExtendedTrend,
  getTrend,
  HISTORY_DIR,
  loadSnapshots,
  pruneByTier,
  pruneHistory,
  RETENTION_DAYS,
  renderSparkline,
  saveSnapshot,
} from './analysis/history';
export { generateReportFromDocCov, loadCachedReport, saveReport } from './analysis/report';
export type { SchemaDetectionContext, SchemaDetectionResult } from './analysis/schema-detection';
// Schema detection
export { detectRuntimeSchemas } from './analysis/schema-detection';
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
export type { ExampleValidationMode, SchemaExtractionMode } from './config';
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
  findPackageByName,
  formatPackageList,
  getInstallCommand,
  getPrimaryBuildScript,
  getRunCommand,
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
export type {
  ExtractStandardSchemasOptions,
  SchemaAdapter,
  SchemaExtractionResult,
  StandardJSONSchemaV1,
  StandardSchemaExtractionOutput,
  StandardSchemaExtractionResult,
} from './extract/schema';
// Schema extraction
export {
  extractSchemaOutputType,
  extractSchemaType,
  extractStandardSchemas,
  extractStandardSchemasFromProject,
  findAdapter,
  getRegisteredAdapters,
  getSupportedLibraries,
  isSchemaType,
  isStandardJSONSchema,
  resolveCompiledPath,
} from './extract/schema';
export { extractPackageSpec } from './extractor';
export type { FilterSource, ResolvedFilters } from './filtering/merge';
// Filtering
export { mergeFilters, parseListFlag } from './filtering/merge';
export type { ApplyEditsResult, FixType, JSDocParam, JSDocReturn, JSDocTag } from './fix';
// Fix (additional exports)
export { applyPatchToJSDoc, generateFix } from './fix';
export type { ParsedGitHubUrl } from './github';
// GitHub
export {
  buildCloneUrl,
  buildDisplayUrl,
  buildRawUrl,
  fetchSpec,
  fetchSpecFromGitHub,
  parseGitHubUrl,
} from './github';
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
  DEFAULT_REPORT_DIR,
  DEFAULT_REPORT_PATH,
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
