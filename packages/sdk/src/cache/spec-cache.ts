import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OpenPkg } from '@openpkg-ts/spec';
import { diffHashes, hashFile, hashFiles } from './hash';

/** Current cache format version - bump when spec extraction logic changes */
export const CACHE_VERSION = '1.1.0';

/** Default cache file path */
export const SPEC_CACHE_FILE = '.doccov/spec.cache.json';

/**
 * Configuration that affects spec generation output.
 */
export interface SpecCacheConfig {
  resolveExternalTypes: boolean;
}

/**
 * Cached spec with validation metadata.
 */
export interface SpecCache {
  /** Cache format version for migrations */
  cacheVersion: string;

  /** When cache was generated (ISO timestamp) */
  generatedAt: string;

  /** OpenPkg spec version (e.g., "0.3.0") */
  specVersion: string;

  /** Entry file that was analyzed (relative path) */
  entryFile: string;

  /** Hash validation data */
  hashes: {
    /** Hash of tsconfig.json content (null if not found) */
    tsconfig: string | null;

    /** Hash of package.json content */
    packageJson: string;

    /** Source file hashes: relative filepath → content hash */
    sourceFiles: Record<string, string>;
  };

  /** Analysis configuration that affects output */
  config: SpecCacheConfig;

  /** The cached OpenPkg spec */
  spec: OpenPkg;
}

/**
 * Result of cache validation.
 */
export interface CacheValidationResult {
  /** Whether the cache is valid */
  valid: boolean;

  /** Reason for invalidation (if invalid) */
  reason?:
    | 'cache-version-mismatch'
    | 'entry-file-changed'
    | 'config-changed'
    | 'tsconfig-changed'
    | 'package-json-changed'
    | 'source-files-changed';

  /** Files that changed (if reason is source-files-changed) */
  changedFiles?: string[];
}

/**
 * Context needed for cache operations.
 */
export interface CacheContext {
  /** Entry file being analyzed (absolute path) */
  entryFile: string;

  /** Source files included in analysis (absolute paths) */
  sourceFiles: string[];

  /** Path to tsconfig.json (absolute, or null if not found) */
  tsconfigPath: string | null;

  /** Path to package.json (absolute) */
  packageJsonPath: string;

  /** Configuration that affects output */
  config: SpecCacheConfig;

  /** Working directory */
  cwd: string;
}

/**
 * Load cached spec from disk.
 *
 * @param cwd - Working directory
 * @returns Cached spec, or null if not found or invalid JSON
 */
export function loadSpecCache(cwd: string): SpecCache | null {
  try {
    const cachePath = path.resolve(cwd, SPEC_CACHE_FILE);
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    const content = fs.readFileSync(cachePath, 'utf-8');
    return JSON.parse(content) as SpecCache;
  } catch {
    return null;
  }
}

/**
 * Save spec to cache.
 *
 * @param spec - OpenPkg spec to cache
 * @param context - Cache context with file paths and config
 */
export function saveSpecCache(spec: OpenPkg, context: CacheContext): void {
  const { entryFile, sourceFiles, tsconfigPath, packageJsonPath, config, cwd } = context;

  const cache: SpecCache = {
    cacheVersion: CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    specVersion: spec.openpkg,
    entryFile: path.relative(cwd, entryFile),
    hashes: {
      tsconfig: tsconfigPath ? hashFile(tsconfigPath) : null,
      packageJson: hashFile(packageJsonPath) ?? '',
      sourceFiles: hashFiles(sourceFiles, cwd),
    },
    config,
    spec,
  };

  const cachePath = path.resolve(cwd, SPEC_CACHE_FILE);
  const dir = path.dirname(cachePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

/**
 * Validate if cached spec is still valid.
 *
 * Checks:
 * 1. Cache version matches
 * 2. Entry file matches
 * 3. Config matches
 * 4. tsconfig.json hash matches
 * 5. package.json hash matches
 * 6. All source file hashes match
 *
 * @param cache - Cached spec to validate
 * @param context - Current cache context
 * @returns Validation result
 */
export function validateSpecCache(cache: SpecCache, context: CacheContext): CacheValidationResult {
  const { entryFile, sourceFiles, tsconfigPath, packageJsonPath, config, cwd } = context;

  // Check cache version
  if (cache.cacheVersion !== CACHE_VERSION) {
    return { valid: false, reason: 'cache-version-mismatch' };
  }

  // Check entry file matches
  const relativeEntry = path.relative(cwd, entryFile);
  if (cache.entryFile !== relativeEntry) {
    return { valid: false, reason: 'entry-file-changed' };
  }

  // Check config matches
  if (cache.config.resolveExternalTypes !== config.resolveExternalTypes) {
    return { valid: false, reason: 'config-changed' };
  }

  // Check tsconfig hash
  const currentTsconfigHash = tsconfigPath ? hashFile(tsconfigPath) : null;
  if (cache.hashes.tsconfig !== currentTsconfigHash) {
    return { valid: false, reason: 'tsconfig-changed' };
  }

  // Check package.json hash
  const currentPackageHash = hashFile(packageJsonPath);
  if (cache.hashes.packageJson !== currentPackageHash) {
    return { valid: false, reason: 'package-json-changed' };
  }

  // Check source file hashes
  const currentHashes = hashFiles(sourceFiles, cwd);
  const changedFiles = diffHashes(cache.hashes.sourceFiles, currentHashes);

  if (changedFiles.length > 0) {
    return { valid: false, reason: 'source-files-changed', changedFiles };
  }

  return { valid: true };
}

/**
 * Clear the spec cache.
 *
 * @param cwd - Working directory
 * @returns True if cache was deleted, false if it didn't exist
 */
export function clearSpecCache(cwd: string): boolean {
  const cachePath = path.resolve(cwd, SPEC_CACHE_FILE);
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    return true;
  }
  return false;
}

/**
 * Get cache file path for a given working directory.
 *
 * @param cwd - Working directory
 * @returns Absolute path to cache file
 */
export function getSpecCachePath(cwd: string): string {
  return path.resolve(cwd, SPEC_CACHE_FILE);
}
