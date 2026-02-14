import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createProgram } from '@openpkg-ts/sdk';
import type * as TS from 'typescript';
import type { BuildDriftOptions } from './analysis/drift-builder';
import { buildDriftSpec } from './analysis/drift-builder';
import type { AnalysisMetadataInternal } from './analysis/run-analysis';
import { runAnalysis } from './analysis/run-analysis';
import type { OpenPkgSpec } from './analysis/spec-types';
import {
  type CacheContext,
  type CachedDiagnostic,
  type CachedForgottenExport,
  type CacheValidationResult,
  loadSpecCache,
  saveSpecCache,
  validateSpecCache,
} from './cache/spec-cache';
import { extractPackageSpec } from './extractor';
import { applyFilters } from './filtering/apply-filters';
import type { FilterOptions } from './filtering/types';
import type { DriftOptions, NormalizedDriftOptions } from './options';
import { normalizeDriftOptions } from './options';
import type { DriftSpec } from './spec';
import { ts } from './ts-module';

export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  code?: string;
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
}

export interface AnalysisResult {
  spec: OpenPkgSpec;
  diagnostics: Diagnostic[];
  metadata: AnalysisMetadata;
  /** True if result came from cache (no fresh analysis) */
  fromCache?: boolean;
  /** Cache validation details (if cache was checked) */
  cacheStatus?: CacheValidationResult;
  /** Forgotten exports (types referenced but not exported) */
  forgottenExports?: ForgottenExportResult[];
}

export interface ForgottenExportResult {
  name: string;
  definedIn?: string;
  referencedBy: Array<{
    typeName: string;
    exportName: string;
    location: 'return' | 'parameter' | 'property' | 'extends' | 'type-parameter';
    path?: string;
  }>;
  isExternal: boolean;
  fix?: string;
}

export interface AnalysisMetadata {
  baseDir: string;
  configPath?: string;
  packageJsonPath?: string;
  hasNodeModules: boolean;
  resolveExternalTypes: boolean;
  /** Source files included in analysis (for caching) */
  sourceFiles?: string[];
}

export interface AnalyzeOptions {
  filters?: FilterOptions;
}

export type ScanOptions = Omit<BuildDriftOptions, 'openpkg' | 'openpkgPath' | 'packagePath'>;

export class Drift {
  private readonly options: NormalizedDriftOptions;

  constructor(options: DriftOptions = {}) {
    this.options = normalizeDriftOptions(options);
  }

  async scan(entry: string, options?: ScanOptions): Promise<DriftSpec> {
    const result = await this.analyzeFileWithDiagnostics(entry);
    const resolvedEntry = path.resolve(entry);
    return buildDriftSpec({
      openpkg: result.spec,
      openpkgPath: resolvedEntry,
      packagePath: resolvePackageDir(resolvedEntry),
      forgottenExports: result.forgottenExports?.map((fe) => ({
        name: fe.name,
        definedIn: fe.definedIn,
        referencedBy: fe.referencedBy,
        isExternal: fe.isExternal,
        fix: fe.fix,
      })),
      ...options,
    });
  }

  async analyze(
    code: string,
    fileName = 'temp.ts',
    analyzeOptions: AnalyzeOptions = {},
  ): Promise<OpenPkgSpec> {
    const resolvedFileName = path.resolve(fileName);
    const tempDir = path.dirname(resolvedFileName);
    const spec = await extractPackageSpec(resolvedFileName, tempDir, code, this.options);
    return this.applySpecFilters(spec, analyzeOptions.filters).spec;
  }

  async analyzeFile(filePath: string, analyzeOptions: AnalyzeOptions = {}): Promise<OpenPkgSpec> {
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const packageDir = resolvePackageDir(resolvedPath);
    const spec = await extractPackageSpec(resolvedPath, packageDir, content, this.options);
    return this.applySpecFilters(spec, analyzeOptions.filters).spec;
  }

  async analyzeProject(
    entryPath: string,
    analyzeOptions: AnalyzeOptions = {},
  ): Promise<OpenPkgSpec> {
    return this.analyzeFile(entryPath, analyzeOptions);
  }

  async analyzeWithDiagnostics(
    code: string,
    fileName?: string,
    analyzeOptions: AnalyzeOptions = {},
  ): Promise<AnalysisResult> {
    const resolvedFileName = path.resolve(fileName ?? 'temp.ts');
    const packageDir = resolvePackageDir(resolvedFileName);

    const analysis = await runAnalysis({
      entryFile: resolvedFileName,
      packageDir,
      content: code,
      options: this.options,
    });

    const filterOutcome = this.applySpecFilters(analysis.spec, analyzeOptions.filters);

    return {
      spec: filterOutcome.spec,
      diagnostics: [
        ...analysis.diagnostics.map((diagnostic) => this.normalizeDiagnostic(diagnostic)),
        ...analysis.specDiagnostics,
        ...filterOutcome.diagnostics,
      ],
      metadata: this.normalizeMetadata(analysis.metadata),
      forgottenExports: analysis.forgottenExports,
    };
  }

  async analyzeFileWithDiagnostics(
    filePath: string,
    analyzeOptions: AnalyzeOptions = {},
  ): Promise<AnalysisResult> {
    const resolvedPath = path.resolve(filePath);
    const packageDir = resolvePackageDir(resolvedPath);
    const { useCache, resolveExternalTypes } = this.options;

    // Try cache first if enabled
    if (useCache) {
      const cacheResult = this.tryLoadFromCache(resolvedPath, packageDir, resolveExternalTypes);
      if (cacheResult) {
        // Apply filters to cached spec
        const filterOutcome = this.applySpecFilters(cacheResult.spec, analyzeOptions.filters);
        return {
          spec: filterOutcome.spec,
          diagnostics: [...(cacheResult.specDiagnostics ?? []), ...filterOutcome.diagnostics],
          metadata: cacheResult.metadata,
          fromCache: true,
          cacheStatus: { valid: true },
          forgottenExports: cacheResult.forgottenExports,
        };
      }
    }

    // Run full analysis
    const content = await fs.readFile(resolvedPath, 'utf-8');

    const analysis = await runAnalysis({
      entryFile: resolvedPath,
      packageDir,
      content,
      options: this.options,
    });

    const filterOutcome = this.applySpecFilters(analysis.spec, analyzeOptions.filters);
    const metadata = this.normalizeMetadata(analysis.metadata);

    const result: AnalysisResult = {
      spec: filterOutcome.spec,
      diagnostics: [
        ...analysis.diagnostics.map((diagnostic) => this.normalizeDiagnostic(diagnostic)),
        ...analysis.specDiagnostics,
        ...filterOutcome.diagnostics,
      ],
      metadata,
      fromCache: false,
      forgottenExports: analysis.forgottenExports,
    };

    // Save to cache if enabled
    if (useCache) {
      this.saveToCache(
        result,
        resolvedPath,
        analysis.metadata,
        analysis.specDiagnostics,
        analysis.forgottenExports,
      );
    }

    return result;
  }

  /**
   * Try to load spec from cache.
   * Returns null if cache is invalid or doesn't exist.
   */
  private tryLoadFromCache(
    entryFile: string,
    packageDir: string,
    resolveExternalTypes?: boolean,
  ): {
    spec: OpenPkgSpec;
    metadata: AnalysisMetadata;
    specDiagnostics?: CachedDiagnostic[];
    forgottenExports?: CachedForgottenExport[];
  } | null {
    const { cwd } = this.options;
    const cache = loadSpecCache(cwd);

    if (!cache) {
      return null;
    }

    // Find tsconfig and package.json for validation
    const tsconfigPath = this.findTsConfig(packageDir);
    const packageJsonPath = this.findPackageJson(packageDir);

    if (!packageJsonPath) {
      return null;
    }

    // Get CURRENT source files from a fresh TypeScript program to detect new files
    // This is the key fix: we must compare against current files, not cached files
    const currentSourceFiles = this.getCurrentSourceFiles(entryFile, packageDir);

    const cacheContext: CacheContext = {
      entryFile,
      sourceFiles: currentSourceFiles,
      tsconfigPath,
      packageJsonPath,
      config: {
        resolveExternalTypes: resolveExternalTypes ?? true,
      },
      cwd,
    };

    const validation = validateSpecCache(cache, cacheContext);

    if (!validation.valid) {
      return null;
    }

    // Cache hit - reconstruct metadata using cached source files
    const cachedSourceFiles = Object.keys(cache.hashes.sourceFiles).map((relativePath) =>
      path.resolve(cwd, relativePath),
    );

    return {
      spec: cache.spec as OpenPkgSpec,
      metadata: {
        baseDir: packageDir,
        configPath: tsconfigPath ?? undefined,
        packageJsonPath,
        hasNodeModules: true, // Assume true for cached results
        resolveExternalTypes: cache.config.resolveExternalTypes,
        sourceFiles: cachedSourceFiles,
      },
      specDiagnostics: cache.specDiagnostics,
      forgottenExports: cache.forgottenExports,
    };
  }

  /**
   * Get current source files from a fresh TypeScript program.
   * Used for cache validation to detect new files.
   */
  private getCurrentSourceFiles(entryFile: string, baseDir: string): string[] {
    try {
      const { program } = createProgram({ entryFile, baseDir });
      return program
        .getSourceFiles()
        .filter((sf) => !sf.isDeclarationFile && sf.fileName.startsWith(baseDir))
        .map((sf) => sf.fileName);
    } catch {
      // If we can't create a program, return empty array to invalidate cache
      return [];
    }
  }

  /**
   * Save analysis result to cache.
   */
  private saveToCache(
    result: AnalysisResult,
    entryFile: string,
    metadata: AnalysisMetadataInternal,
    specDiagnostics: Diagnostic[],
    forgottenExports?: ForgottenExportResult[],
  ): void {
    const { cwd } = this.options;

    if (!metadata.packageJsonPath) {
      return; // Can't cache without package.json
    }

    const cacheContext: CacheContext = {
      entryFile,
      sourceFiles: metadata.sourceFiles,
      tsconfigPath: metadata.configPath ?? null,
      packageJsonPath: metadata.packageJsonPath,
      config: {
        resolveExternalTypes: metadata.resolveExternalTypes,
      },
      cwd,
      specDiagnostics,
      forgottenExports,
    };

    try {
      saveSpecCache(result.spec, cacheContext);
    } catch {
      // Cache save failure shouldn't break the flow
    }
  }

  /**
   * Find tsconfig.json starting from a directory.
   */
  private findTsConfig(startDir: string): string | null {
    let current = startDir;
    while (true) {
      const candidate = path.join(current, 'tsconfig.json');
      if (fsSync.existsSync(candidate)) {
        return candidate;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  }

  /**
   * Find package.json starting from a directory.
   */
  private findPackageJson(startDir: string): string | null {
    let current = startDir;
    while (true) {
      const candidate = path.join(current, 'package.json');
      if (fsSync.existsSync(candidate)) {
        return candidate;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  }

  private normalizeDiagnostic(tsDiagnostic: TS.Diagnostic): Diagnostic {
    const message = ts.flattenDiagnosticMessageText(tsDiagnostic.messageText, '\n');

    let location: Diagnostic['location'];
    if (tsDiagnostic.file && typeof tsDiagnostic.start === 'number') {
      const { line, character } = tsDiagnostic.file.getLineAndCharacterOfPosition(
        tsDiagnostic.start,
      );
      location = {
        file: tsDiagnostic.file.fileName,
        line: line + 1,
        column: character + 1,
      };
    }

    const severity = this.mapSeverity(tsDiagnostic.category);

    return {
      message,
      severity,
      location,
    };
  }

  private mapSeverity(category: TS.DiagnosticCategory): Diagnostic['severity'] {
    switch (category) {
      case ts.DiagnosticCategory.Message:
      case ts.DiagnosticCategory.Suggestion:
        return 'info';
      case ts.DiagnosticCategory.Warning:
        return 'warning';
      default:
        return 'error';
    }
  }

  private normalizeMetadata(metadata: AnalysisMetadataInternal): AnalysisMetadata {
    return {
      baseDir: metadata.baseDir,
      configPath: metadata.configPath,
      packageJsonPath: metadata.packageJsonPath,
      hasNodeModules: metadata.hasNodeModules,
      resolveExternalTypes: metadata.resolveExternalTypes,
      sourceFiles: metadata.sourceFiles,
    };
  }

  private applySpecFilters(
    spec: OpenPkgSpec,
    filters?: FilterOptions,
  ): { spec: OpenPkgSpec; diagnostics: Diagnostic[] } {
    if (!filters || (!filters.include?.length && !filters.exclude?.length)) {
      return { spec, diagnostics: [] };
    }

    const result = applyFilters(spec, filters);
    return {
      spec: result.spec,
      diagnostics: result.diagnostics.map((diagnostic) => ({
        message: diagnostic.message,
        severity: diagnostic.severity,
      })),
    };
  }
}

export async function analyze(code: string, options: AnalyzeOptions = {}): Promise<OpenPkgSpec> {
  return new Drift().analyze(code, 'temp.ts', options);
}

export async function analyzeFile(
  filePath: string,
  options: AnalyzeOptions = {},
): Promise<OpenPkgSpec> {
  return new Drift().analyzeFile(filePath, options);
}

export async function scan(entry: string, options?: ScanOptions): Promise<DriftSpec> {
  return new Drift().scan(entry, options);
}

function resolvePackageDir(entryFile: string): string {
  const fallbackDir = path.dirname(entryFile);
  let currentDir = fallbackDir;

  while (true) {
    const candidate = path.join(currentDir, 'package.json');
    if (fsSync.existsSync(candidate)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return fallbackDir;
    }

    currentDir = parentDir;
  }
}
