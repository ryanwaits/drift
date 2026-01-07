/**
 * Entry point detection for TypeScript projects.
 * Resolves dist/build paths to source .ts files when possible.
 */

import * as nodePath from 'node:path';
import type { EntryPointInfo, FileSystem, TsConfigInfo } from './types';
import { readPackageJson, safeParseJson } from './utils';

/**
 * Detect the TypeScript entry point for a package.
 *
 * Priority order:
 * 1. package.json -> types or typings field
 * 2. package.json -> exports["."].types
 * 3. package.json -> main field (resolve to .ts)
 * 4. package.json -> module field (resolve to .ts)
 * 5. Common fallback paths
 *
 * @param fs - FileSystem implementation
 * @param packagePath - Path to package directory (default: ".")
 * @returns Entry point info
 * @throws Error if no entry point can be found
 */
export async function detectEntryPoint(fs: FileSystem, packagePath = '.'): Promise<EntryPointInfo> {
  const pkgJson = await readPackageJson(fs, packagePath);

  if (!pkgJson) {
    throw new Error('No package.json found - not a valid npm package');
  }

  // Parse tsconfig for outDir/rootDir mapping
  const tsConfig = await parseTsConfig(fs, packagePath);

  // 1. Check types/typings field (most explicit)
  const typesField = pkgJson.types || pkgJson.typings;
  if (typesField && typeof typesField === 'string') {
    const resolved = await resolveToSource(fs, packagePath, typesField, tsConfig);
    if (resolved) {
      return { ...resolved, source: 'types' };
    }
  }

  // 2. Check exports["."].types
  if (pkgJson.exports && typeof pkgJson.exports === 'object') {
    const dotExport = pkgJson.exports['.'];
    if (dotExport && typeof dotExport === 'object' && 'types' in dotExport) {
      const typesPath = (dotExport as { types?: string }).types;
      if (typesPath && typeof typesPath === 'string') {
        const resolved = await resolveToSource(fs, packagePath, typesPath, tsConfig);
        if (resolved) {
          return { ...resolved, source: 'exports' };
        }
      }
    }
  }

  // 3. Check main field
  if (pkgJson.main && typeof pkgJson.main === 'string') {
    const resolved = await resolveToSource(fs, packagePath, pkgJson.main, tsConfig);
    if (resolved) {
      return { ...resolved, source: 'main' };
    }
  }

  // 4. Check module field
  if (pkgJson.module && typeof pkgJson.module === 'string') {
    const resolved = await resolveToSource(fs, packagePath, pkgJson.module, tsConfig);
    if (resolved) {
      return { ...resolved, source: 'module' };
    }
  }

  // 5. Fallback to common paths (expanded list)
  const fallbacks = [
    'src/index.ts',
    'src/index.tsx',
    'src/main.ts',
    'src/mod.ts', // Deno convention
    'src/lib/index.ts',
    'index.ts',
    'main.ts',
    'lib/index.ts',
    'source/index.ts',
  ];

  for (const fallback of fallbacks) {
    const checkPath = packagePath === '.' ? fallback : `${packagePath}/${fallback}`;
    if (await fs.exists(checkPath)) {
      // Return path relative to packagePath, not including packagePath prefix
      return { path: fallback, source: 'fallback', isDeclarationOnly: false };
    }
  }

  throw new Error(
    'Could not detect TypeScript entry point. No types field in package.json and no common entry paths found.',
  );
}

/**
 * Parse tsconfig.json to extract outDir/rootDir mappings.
 */
async function parseTsConfig(fs: FileSystem, packagePath: string): Promise<TsConfigInfo | null> {
  const tsconfigPath = packagePath === '.' ? 'tsconfig.json' : `${packagePath}/tsconfig.json`;
  const tsconfig = await safeParseJson<{
    compilerOptions?: {
      outDir?: string;
      rootDir?: string;
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  }>(fs, tsconfigPath);

  if (!tsconfig?.compilerOptions) {
    return null;
  }

  const { outDir, rootDir, baseUrl, paths } = tsconfig.compilerOptions;
  return { outDir, rootDir, baseUrl, paths };
}

/**
 * Resolve a file path to its TypeScript source equivalent.
 * Uses tsconfig.json outDir/rootDir when available, falls back to heuristics.
 *
 * @param fs - FileSystem implementation
 * @param basePath - Base directory path
 * @param filePath - Original file path from package.json
 * @param tsConfig - Optional parsed tsconfig info
 * @returns Resolved path info, or null if not found
 */
async function resolveToSource(
  fs: FileSystem,
  basePath: string,
  filePath: string,
  tsConfig?: TsConfigInfo | null,
): Promise<{ path: string; isDeclarationOnly: boolean } | null> {
  // Normalize path (remove leading ./)
  const normalized = filePath.replace(/^\.\//, '');

  // Helper to build full path for existence checks (includes basePath)
  const checkPath = (p: string) => (basePath === '.' ? p : `${basePath}/${p}`);

  // Already a .ts source file (not .d.ts)
  const isSourceTs =
    (normalized.endsWith('.ts') && !normalized.endsWith('.d.ts')) || normalized.endsWith('.tsx');
  if (isSourceTs) {
    if (await fs.exists(checkPath(normalized))) {
      // Return path relative to basePath, not including basePath prefix
      return { path: normalized, isDeclarationOnly: false };
    }
  }

  // Generate candidate source paths
  const candidates: string[] = [];

  // Use tsconfig outDir/rootDir mapping if available
  if (tsConfig?.outDir && tsConfig?.rootDir) {
    const outDir = tsConfig.outDir.replace(/^\.\//, '').replace(/\/$/, '');
    const rootDir = tsConfig.rootDir.replace(/^\.\//, '').replace(/\/$/, '');

    if (normalized.startsWith(`${outDir}/`)) {
      const srcPath = normalized.replace(`${outDir}/`, `${rootDir}/`);
      candidates.push(srcPath.replace(/\.js$/, '.ts'));
      candidates.push(srcPath.replace(/\.d\.ts$/, '.ts'));
      candidates.push(srcPath.replace(/\.mjs$/, '.mts'));
      candidates.push(srcPath.replace(/\.cjs$/, '.cts'));
      candidates.push(srcPath.replace(/\.js$/, '.tsx'));
    }
  }

  // Fallback heuristics for common output directories
  const outputDirs = ['dist', 'build', 'lib', 'out', 'output', 'esm', 'cjs', 'target'];
  for (const outDir of outputDirs) {
    if (normalized.startsWith(`${outDir}/`)) {
      const srcPath = normalized.replace(new RegExp(`^${outDir}/`), 'src/');
      candidates.push(srcPath.replace(/\.js$/, '.ts'));
      candidates.push(srcPath.replace(/\.d\.ts$/, '.ts'));
      candidates.push(srcPath.replace(/\.mjs$/, '.mts'));
      candidates.push(srcPath.replace(/\.cjs$/, '.cts'));
      candidates.push(srcPath.replace(/\.js$/, '.tsx'));
    }
  }

  // Direct .js -> .ts conversion
  candidates.push(normalized.replace(/\.js$/, '.ts'));
  candidates.push(normalized.replace(/\.d\.ts$/, '.ts'));
  candidates.push(normalized.replace(/\.mjs$/, '.mts'));
  candidates.push(normalized.replace(/\.cjs$/, '.cts'));
  candidates.push(normalized.replace(/\.js$/, '.tsx'));

  // For .d.ts in root, try src/index.ts
  if (normalized.endsWith('.d.ts')) {
    const baseName = normalized
      .replace(/\.d\.ts$/, '')
      .split('/')
      .pop();
    if (baseName) {
      candidates.push(`src/${baseName}.ts`);
    }
  }

  // Check each candidate (skip .d.ts files - we want source, not declarations)
  for (const candidate of candidates) {
    if (candidate.endsWith('.d.ts')) continue;
    if (await fs.exists(checkPath(candidate))) {
      // Return path relative to basePath, not including basePath prefix
      return { path: candidate, isDeclarationOnly: false };
    }
  }

  // Fall back to .d.ts if that's all we have
  if (normalized.endsWith('.d.ts')) {
    if (await fs.exists(checkPath(normalized))) {
      // Return path relative to basePath, not including basePath prefix
      return { path: normalized, isDeclarationOnly: true };
    }
  }

  return null;
}

/**
 * Find the package entry point for a given source file.
 * Walks up directories to find package.json and detects entry point.
 *
 * @param fs - FileSystem implementation
 * @param filePath - Absolute or relative path to the source file
 * @returns Entry point info and package path, or null if not found
 */
export async function findEntryPointForFile(
  fs: FileSystem,
  filePath: string,
): Promise<{ entryPoint: EntryPointInfo; packagePath: string } | null> {
  // Get directory of the file
  let currentDir = nodePath.dirname(filePath);

  // Walk up to find package.json
  while (currentDir !== nodePath.dirname(currentDir)) {
    const hasPackageJson = await fs.exists(nodePath.join(currentDir, 'package.json'));
    if (hasPackageJson) {
      try {
        const entryPoint = await detectEntryPoint(fs, currentDir);
        return { entryPoint, packagePath: currentDir };
      } catch {
        // No valid entry point in this package, continue up
      }
    }
    currentDir = nodePath.dirname(currentDir);
  }

  return null;
}

/**
 * Check if a file is the package entry point.
 *
 * @param fs - FileSystem implementation
 * @param filePath - Path to check
 * @returns True if the file is the package entry point
 */
export async function isPackageEntryPoint(fs: FileSystem, filePath: string): Promise<boolean> {
  const result = await findEntryPointForFile(fs, filePath);
  if (!result) return false;

  const entryAbsolute = nodePath.resolve(result.packagePath, result.entryPoint.path);
  const fileAbsolute = nodePath.resolve(filePath);

  return entryAbsolute === fileAbsolute;
}
