// Types

export { SCHEMA_URL, SCHEMA_VERSION } from './constants';
export type {
  ApiSurfaceResult,
  DriftIssue,
  DriftSpec,
  DriftSpecVersion,
  DriftSummary,
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
export type { DriftSchemaVersion, DriftSpecError } from './validate';
export {
  assertDriftSpec,
  getAvailableDriftVersions,
  getDriftValidationErrors,
  LATEST_VERSION,
  validateDriftSpec,
} from './validate';
