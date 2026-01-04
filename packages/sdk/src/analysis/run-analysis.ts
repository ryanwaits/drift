import * as fs from 'node:fs';
import * as path from 'node:path';
import { extract, type ForgottenExport } from '@openpkg-ts/extract';
import type { OpenPkg } from '@openpkg-ts/spec';
import type * as TS from 'typescript';
import { ts } from '../ts-module';
import type { AnalysisContextInput } from './context';
import { createAnalysisContext } from './context';

export interface AnalysisMetadataInternal {
  baseDir: string;
  configPath?: string;
  packageJsonPath?: string;
  hasNodeModules: boolean;
  resolveExternalTypes: boolean;
  /** Source files included in analysis (for caching) */
  sourceFiles: string[];
}

export interface SpecDiagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface RunAnalysisResult {
  spec: OpenPkg;
  metadata: AnalysisMetadataInternal;
  diagnostics: readonly TS.Diagnostic[];
  specDiagnostics: SpecDiagnostic[];
  forgottenExports?: ForgottenExport[];
}

function findNearestPackageJson(startDir: string): string | undefined {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function canResolveExternalModules(program: TS.Program, baseDir: string): boolean {
  const sourceFiles = program.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    if (!sourceFile.fileName.startsWith(baseDir)) continue;

    const resolvedModules = (sourceFile as { resolvedModules?: Map<string, unknown> })
      .resolvedModules;
    if (resolvedModules) {
      for (const [moduleName, resolution] of resolvedModules.entries()) {
        if (!moduleName.startsWith('.') && !moduleName.startsWith('/')) {
          if (resolution) {
            return true;
          }
        }
      }
    }
  }

  return hasNodeModulesDirectoryFallback(baseDir);
}

function hasNodeModulesDirectoryFallback(startDir: string): boolean {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, 'node_modules');
    if (fs.existsSync(candidate)) {
      return true;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return false;
}

function hasExternalImports(sourceFile: TS.SourceFile): boolean {
  let found = false;
  ts.forEachChild(sourceFile, (node) => {
    if (found) return;
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const specifier = node.moduleSpecifier;
      if (ts.isStringLiteral(specifier)) {
        const modulePath = specifier.text;
        if (!modulePath.startsWith('.') && !modulePath.startsWith('/')) {
          found = true;
        }
      }
    }
  });
  return found;
}

export async function runAnalysis(input: AnalysisContextInput): Promise<RunAnalysisResult> {
  // Create context for TS diagnostics and metadata
  const context = createAnalysisContext(input);
  const { baseDir, options, program } = context;

  const packageJsonPath = findNearestPackageJson(baseDir);
  const hasNodeModules = canResolveExternalModules(program, baseDir);
  const resolveExternalTypes =
    options.resolveExternalTypes !== undefined ? options.resolveExternalTypes : hasNodeModules;

  // Filter benign TS5053
  const diagnostics = ts.getPreEmitDiagnostics(context.program).filter((d) => {
    if (d.code === 5053) return false;
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    return !/allowJs/i.test(msg);
  });

  // Collect spec-level diagnostics
  const specDiagnostics: SpecDiagnostic[] = [];

  // Check if external imports exist but no node_modules found
  if (!hasNodeModules && hasExternalImports(context.sourceFile)) {
    specDiagnostics.push({
      message: 'External imports detected but node_modules not found.',
      severity: 'info',
      suggestion: 'Run npm install or bun install for complete type resolution.',
    });
  }

  // Use extract package for spec generation
  const extractResult = await extract({
    entryFile: input.entryFile,
    baseDir,
    content: input.content,
    maxTypeDepth: options.maxDepth,
    resolveExternalTypes,
    includeSchema: true,
  });

  // Merge extract diagnostics into specDiagnostics
  for (const diag of extractResult.diagnostics) {
    specDiagnostics.push({
      message: diag.message,
      severity: diag.severity,
      suggestion: diag.suggestion,
    });
  }

  // Collect source files from the program (for caching)
  const sourceFiles = program
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile && sf.fileName.startsWith(baseDir))
    .map((sf) => sf.fileName);

  return {
    spec: extractResult.spec,
    metadata: {
      baseDir,
      configPath: context.configPath,
      packageJsonPath,
      hasNodeModules,
      resolveExternalTypes,
      sourceFiles,
    },
    diagnostics,
    specDiagnostics,
    forgottenExports: extractResult.forgottenExports,
  };
}
