/**
 * OpenAPI adapter for Drift.
 *
 * Maps an OpenAPI 3.0/3.1 document → ApiSpec so REST API surfaces can run
 * through the same drift analysis as TypeScript packages.
 */
import type { ApiSpec } from '@driftdev/sdk/types';
import { toApiSpec } from './to-api-spec';
import type { OpenApiDocument } from './types';

export { deepResolve, resolveRef } from './resolve-ref';
export { toApiSpec } from './to-api-spec';
export type { OpenApiDocument, OperationObject, ParameterObject, SchemaObject } from './types';

/**
 * Convenience: parse a JSON document string (or accept a parsed object)
 * and map it → ApiSpec in one call.
 */
export function fromDocument(
  document: string | OpenApiDocument,
  meta?: { name?: string; version?: string },
): ApiSpec {
  let doc: OpenApiDocument;
  if (typeof document === 'string') {
    try {
      doc = JSON.parse(document) as OpenApiDocument;
    } catch {
      throw new Error('Invalid OpenAPI document: expected JSON (YAML is not supported yet)');
    }
  } else {
    doc = document;
  }
  return toApiSpec(doc, meta);
}
