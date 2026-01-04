/**
 * Schema Type Extraction Module
 *
 * Re-exports from @openpkg-ts/extract with SDK-specific convenience wrappers.
 */
import type * as TS from 'typescript';

// Re-export everything from @openpkg-ts/extract
export {
  // Adapters
  arktypeAdapter,
  typeboxAdapter,
  valibotAdapter,
  zodAdapter,
  // Registry functions
  extractSchemaType,
  findAdapter,
  isSchemaType,
  // Standard Schema
  extractStandardSchemas,
  extractStandardSchemasFromProject,
  isStandardJSONSchema,
  resolveCompiledPath,
  // Types
  getNonNullableType,
  isTypeReference,
  type ExtractStandardSchemasOptions,
  type SchemaAdapter,
  type SchemaExtractionResult,
  type StandardJSONSchemaV1,
  type StandardSchemaExtractionOutput,
  type StandardSchemaExtractionResult,
} from '@openpkg-ts/extract';

import {
  arktypeAdapter,
  findAdapter,
  typeboxAdapter,
  valibotAdapter,
  zodAdapter,
  type SchemaAdapter,
} from '@openpkg-ts/extract';

// SDK-specific convenience wrappers

/** Static list of adapters in check priority order */
const adapters: readonly SchemaAdapter[] = [
  zodAdapter,
  arktypeAdapter,
  typeboxAdapter,
  valibotAdapter,
];

/**
 * Extract the output type from a schema type.
 * Convenience wrapper that returns just the type.
 */
export function extractSchemaOutputType(type: TS.Type, checker: TS.TypeChecker): TS.Type | null {
  const adapter = findAdapter(type, checker);
  if (!adapter) {
    return null;
  }
  return adapter.extractOutputType(type, checker);
}

/**
 * Get all registered adapters.
 */
export function getRegisteredAdapters(): readonly SchemaAdapter[] {
  return adapters;
}

/**
 * Get supported library names.
 */
export function getSupportedLibraries(): readonly string[] {
  return adapters.flatMap((a) => a.packages);
}
