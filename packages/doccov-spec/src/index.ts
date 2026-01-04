// Types

export { SCHEMA_URL, SCHEMA_VERSION } from './constants';
export type {
  ApiSurfaceResult,
  DocCovDrift,
  DocCovSpec,
  DocCovSpecVersion,
  DocCovSummary,
  DocumentationHealth,
  DriftCategory,
  DriftType,
  ExampleAnalysis,
  ExampleRuntimeDrift,
  ExampleTypecheckError,
  ExportAnalysis,
  ForgottenExport,
  MissingDocRule,
  TypeReferenceLocation,
} from './types';
// Constants
export {
  DRIFT_CATEGORIES,
  DRIFT_CATEGORY_DESCRIPTIONS,
  DRIFT_CATEGORY_LABELS,
} from './types';

// Validation
export type { DocCovSchemaVersion, DocCovSpecError } from './validate';
export {
  assertDocCovSpec,
  getAvailableDocCovVersions,
  getDocCovValidationErrors,
  LATEST_VERSION,
  validateDocCovSpec,
} from './validate';
