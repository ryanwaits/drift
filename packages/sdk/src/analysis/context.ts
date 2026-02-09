import * as path from 'node:path';
import type * as ts from 'typescript';
import type { DocCovOptions, NormalizedDocCovOptions } from '../options';
import { normalizeDocCovOptions } from '../options';
import { createProgram } from '@openpkg-ts/sdk';

/**
 * Pre-detected Standard Schema for a variable export.
 */
export interface DetectedSchemaEntry {
  schema: Record<string, unknown>;
  vendor: string;
}

export interface AnalysisContext {
  entryFile: string;
  baseDir: string;
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  compilerOptions: ts.CompilerOptions;
  compilerHost: ts.CompilerHost;
  options: NormalizedDocCovOptions;
  configPath?: string;
  /** Pre-detected Standard Schemas (from runtime detection) */
  detectedSchemas?: Map<string, DetectedSchemaEntry>;
}

export interface AnalysisContextInput {
  entryFile: string;
  packageDir?: string;
  content?: string;
  options?: DocCovOptions;
  /** Pre-detected Standard Schemas (from runtime detection) */
  detectedSchemas?: Map<string, DetectedSchemaEntry>;
}

export function createAnalysisContext({
  entryFile,
  packageDir,
  content,
  options,
  detectedSchemas,
}: AnalysisContextInput): AnalysisContext {
  const baseDir = packageDir ?? path.dirname(entryFile);
  const normalizedOptions: NormalizedDocCovOptions = normalizeDocCovOptions(options);

  const programResult = createProgram({ entryFile, baseDir, content });

  if (!programResult.sourceFile) {
    throw new Error(`Could not load ${entryFile}`);
  }

  return {
    entryFile,
    baseDir,
    program: programResult.program,
    checker: programResult.program.getTypeChecker(),
    sourceFile: programResult.sourceFile,
    compilerOptions: programResult.compilerOptions,
    compilerHost: programResult.compilerHost,
    options: normalizedOptions,
    configPath: programResult.configPath,
    detectedSchemas,
  };
}
