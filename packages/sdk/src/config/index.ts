/**
 * Configuration module - types and validation for DocCov configuration.
 */

// Zod schema for config validation (used by CLI)
export type { DocCovConfigInput } from './schema';
export { docCovConfigSchema, normalizeConfig } from './schema';
export type {
  CheckConfig,
  DocCovConfig,
  DocsConfig,
  ExampleValidationMode,
  SchemaExtractionMode,
} from './types';
export { defineConfig } from './types';
