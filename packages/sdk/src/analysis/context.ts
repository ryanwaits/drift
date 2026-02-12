import * as path from 'node:path';
import { createProgram } from '@openpkg-ts/sdk';
import type * as ts from 'typescript';
import type { DriftOptions, NormalizedDriftOptions } from '../options';
import { normalizeDriftOptions } from '../options';

export interface AnalysisContext {
  entryFile: string;
  baseDir: string;
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  compilerOptions: ts.CompilerOptions;
  compilerHost: ts.CompilerHost;
  options: NormalizedDriftOptions;
  configPath?: string;
}

export interface AnalysisContextInput {
  entryFile: string;
  packageDir?: string;
  content?: string;
  options?: DriftOptions;
}

export function createAnalysisContext({
  entryFile,
  packageDir,
  content,
  options,
}: AnalysisContextInput): AnalysisContext {
  const baseDir = packageDir ?? path.dirname(entryFile);
  const normalizedOptions: NormalizedDriftOptions = normalizeDriftOptions(options);

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
  };
}
