/**
 * Configuration module - types and validation for Drift configuration.
 */

export type { DriftConfigInput } from './schema';
export { driftConfigSchema, normalizeConfig, parseDriftConfig } from './schema';
export type {
  CoverageConfig,
  DocsConfig,
  DriftConfig,
  ExamplesConfig,
  ExampleValidationMode,
} from './types';
export { defineConfig } from './types';
