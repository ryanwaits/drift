/**
 * Runtime Schema Detection
 *
 * Detects and extracts schemas from validation libraries that implement
 * the Standard Schema interface (Zod 3.24+, ArkType, Valibot, etc.)
 */

import {
  extractStandardSchemasFromProject,
  resolveCompiledPath,
} from '../extract/schema';

export interface SchemaDetectionContext {
  baseDir: string;
  entryFile: string;
}

export interface DetectedSchema {
  schema: Record<string, unknown>;
  vendor: string;
}

export interface SchemaDetectionResult {
  schemas: Map<string, DetectedSchema>;
  errors: string[];
  /** Warning when runtime was requested but compiled JS not found */
  noCompiledJsWarning?: boolean;
}

export async function detectRuntimeSchemas(
  context: SchemaDetectionContext,
): Promise<SchemaDetectionResult> {
  const { baseDir, entryFile } = context;

  // Check if compiled JS exists
  const compiledPath = resolveCompiledPath(entryFile, baseDir);
  if (!compiledPath) {
    return {
      schemas: new Map(),
      errors: [],
      noCompiledJsWarning: true,
    };
  }

  // Run Standard Schema extraction
  const extraction = await extractStandardSchemasFromProject(entryFile, baseDir);

  const schemas = new Map<string, DetectedSchema>();
  for (const [name, result] of extraction.schemas) {
    schemas.set(name, {
      schema: result.outputSchema,
      vendor: result.vendor,
    });
  }

  return {
    schemas,
    errors: extraction.errors,
  };
}
