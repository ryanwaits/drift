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
 * Normalized DocCov configuration.
 */
export interface DocCovConfig {
  /** Export include patterns */
  include?: string[];
  /** Export exclude patterns */
  exclude?: string[];
  /** Documentation configuration */
  docs?: DocsConfig;
}

/**
 * Define a DocCov configuration.
 * Helper function for type-safe configuration in drift.config.ts.
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
