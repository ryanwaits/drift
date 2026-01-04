import * as path from 'node:path';
import type { DetectedSchemaEntry } from './analysis/context';
import { runAnalysis } from './analysis/run-analysis';
import type { OpenPkgSpec } from './analysis/spec-types';
import { extractStandardSchemasFromProject } from './extract/schema';
import type { DocCovOptions } from './options';

export async function extractPackageSpec(
  entryFile: string,
  packageDir?: string,
  content?: string,
  options?: DocCovOptions,
): Promise<OpenPkgSpec> {
  const baseDir = packageDir ?? path.dirname(entryFile);
  const schemaMode = options?.schemaExtraction ?? 'static';

  // Try Standard Schema runtime extraction if mode is 'runtime' or 'hybrid'
  let detectedSchemas: Map<string, DetectedSchemaEntry> | undefined;

  if (schemaMode === 'runtime' || schemaMode === 'hybrid') {
    const extraction = await extractStandardSchemasFromProject(entryFile, baseDir);

    if (extraction.schemas.size > 0) {
      detectedSchemas = new Map();
      for (const [name, result] of extraction.schemas) {
        detectedSchemas.set(name, {
          schema: result.outputSchema,
          vendor: result.vendor,
        });
      }
    }

    if (extraction.errors.length > 0) {
      console.warn(
        `[doccov] Schema extraction warnings:\n${extraction.errors.map((e) => `  - ${e}`).join('\n')}`,
      );
    }
  }

  const result = await runAnalysis({
    entryFile,
    packageDir,
    content,
    options,
    detectedSchemas,
  });

  return result.spec;
}
