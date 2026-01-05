import * as path from 'node:path';
import ts from 'typescript';

/**
 * Check if file is a JavaScript file
 */
function isJsFile(file: string): boolean {
  return /\.(js|mjs|cjs|jsx)$/.test(file);
}

/**
 * Get appropriate ScriptKind based on file extension
 */
function getScriptKind(file: string): ts.ScriptKind {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  if (/\.(js|mjs|cjs)$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.CommonJS,
  lib: ['lib.es2021.d.ts'],
  declaration: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
};

export interface ProgramOptions {
  entryFile: string;
  baseDir?: string;
  content?: string;
}

export interface ProgramResult {
  program: ts.Program;
  compilerHost: ts.CompilerHost;
  compilerOptions: ts.CompilerOptions;
  sourceFile?: ts.SourceFile;
  configPath?: string;
}

export function createProgram({
  entryFile,
  baseDir = path.dirname(entryFile),
  content,
}: ProgramOptions): ProgramResult {
  // Look for tsconfig.json first, fallback to jsconfig.json
  let configPath = ts.findConfigFile(baseDir, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) {
    configPath = ts.findConfigFile(baseDir, ts.sys.fileExists, 'jsconfig.json');
  }
  let compilerOptions: ts.CompilerOptions = { ...DEFAULT_COMPILER_OPTIONS };

  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
    );
    compilerOptions = { ...compilerOptions, ...parsedConfig.options };
  }

  // Handle JS/TS compiler options conflict
  if (isJsFile(entryFile)) {
    // For JS files: enable allowJs/checkJs, disable isolatedDeclarations (conflicts)
    compilerOptions = {
      ...compilerOptions,
      allowJs: true,
      checkJs: true,
      isolatedDeclarations: false,
    };
  } else {
    // For TS files: avoid TS5053 (allowJs cannot be specified with isolatedDeclarations)
    const allowJsVal = (compilerOptions as Record<string, unknown>).allowJs;
    if (typeof allowJsVal === 'boolean' && allowJsVal) {
      compilerOptions = { ...compilerOptions, allowJs: false, checkJs: false };
    }
  }

  const compilerHost = ts.createCompilerHost(compilerOptions, true);
  let inMemorySource: ts.SourceFile | undefined;

  if (content !== undefined) {
    inMemorySource = ts.createSourceFile(
      entryFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(entryFile),
    );

    const originalGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);

    compilerHost.getSourceFile = (
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    ) => {
      if (fileName === entryFile) {
        return inMemorySource;
      }
      return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    };
  }

  const program = ts.createProgram([entryFile], compilerOptions, compilerHost);
  const sourceFile = inMemorySource ?? program.getSourceFile(entryFile);

  return {
    program,
    compilerHost,
    compilerOptions,
    sourceFile,
    configPath,
  };
}
