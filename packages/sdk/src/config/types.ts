/**
 * Configuration types for DocCov.
 * These types are shared between CLI and API.
 */

/**
 * Documentation configuration options.
 */
export interface DocsConfig {
  /** Glob patterns for markdown docs to include */
  include?: string[];
  /** Glob patterns for markdown docs to exclude */
  exclude?: string[];
}

/**
 * Example validation modes.
 */
export type ExampleValidationMode = 'presence' | 'typecheck' | 'run';

/**
 * Schema extraction modes for validation libraries (Zod, Valibot, TypeBox, ArkType).
 *
 * - 'static': TypeScript Compiler API only (no runtime, always safe)
 * - 'runtime': Standard Schema runtime extraction (requires built package)
 * - 'hybrid': Try runtime first, fall back to static
 */
export type SchemaExtractionMode = 'static' | 'runtime' | 'hybrid';

/**
 * API surface configuration options.
 */
export interface ApiSurfaceConfig {
  /** Minimum completeness percentage to pass (0-100) */
  minCompleteness?: number;
  /** Warning threshold - warn when below this (0-100) */
  warnBelow?: number;
  /** Type names to ignore (won't be flagged as forgotten exports) */
  ignore?: string[];
}

/**
 * Check command configuration options.
 */
export interface CheckConfig {
  /**
   * Example validation modes to run.
   * Can be a single mode, array of modes, or comma-separated string.
   * - 'presence': Check that @example blocks exist on exports
   * - 'typecheck': Compile examples with TypeScript
   * - 'run': Execute examples and validate assertions
   */
  examples?: ExampleValidationMode | ExampleValidationMode[] | string;
  /** Minimum coverage percentage required (0-100) */
  minCoverage?: number;
  /** Maximum drift percentage allowed (0-100) */
  maxDrift?: number;
  /** Minimum API surface completeness percentage (0-100) - deprecated, use apiSurface.minCompleteness */
  minApiSurface?: number;
  /** API surface configuration */
  apiSurface?: ApiSurfaceConfig;
}

/**
 * Normalized DocCov configuration.
 * This is the parsed/normalized form used by commands.
 */
export interface DocCovConfig {
  /** Export include patterns */
  include?: string[];
  /** Export exclude patterns */
  exclude?: string[];
  /** Plugins (future) */
  plugins?: unknown[];
  /** Documentation configuration */
  docs?: DocsConfig;
  /** Check command configuration */
  check?: CheckConfig;
  /**
   * Schema extraction mode for validation libraries.
   *
   * - 'static' (default): Safe, uses TypeScript Compiler API
   * - 'runtime': Uses Standard Schema (requires built package)
   * - 'hybrid': Tries runtime first, falls back to static
   *
   * Runtime extraction provides richer JSON Schema output (formats, patterns)
   * but requires the package to be built first.
   */
  schemaExtraction?: SchemaExtractionMode;
}

/**
 * Define a DocCov configuration.
 * Helper function for type-safe configuration in doccov.config.ts.
 *
 * @param config - Configuration object
 * @returns The configuration object (for type inference)
 *
 * @example
 * ```typescript
 * // doccov.config.ts
 * import { defineConfig } from '@doccov/sdk';
 *
 * export default defineConfig({
 *   include: ['MyClass', 'myFunction'],
 *   exclude: ['internal*'],
 *   check: {
 *     minCoverage: 80,
 *   },
 * });
 * ```
 */
export function defineConfig(config: DocCovConfig): DocCovConfig {
  return config;
}
