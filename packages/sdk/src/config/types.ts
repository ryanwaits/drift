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
 * Normalized DocCov configuration.
 */
export interface DocCovConfig {
  /** Export include patterns */
  include?: string[];
  /** Export exclude patterns */
  exclude?: string[];
  /** Documentation configuration */
  docs?: DocsConfig;
  /**
   * Schema extraction mode for validation libraries.
   *
   * - 'static' (default): Safe, uses TypeScript Compiler API
   * - 'runtime': Uses Standard Schema (requires built package)
   * - 'hybrid': Tries runtime first, falls back to static
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
 * import { defineConfig } from '@driftdev/sdk';
 *
 * export default defineConfig({
 *   include: ['MyClass', 'myFunction'],
 *   exclude: ['internal*'],
 *   docs: { include: ['docs/*.md'] },
 * });
 * ```
 */
export function defineConfig(config: DocCovConfig): DocCovConfig {
  return config;
}
