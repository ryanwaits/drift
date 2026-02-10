/**
 * Spec extraction cache — mtime-based invalidation.
 *
 * Cache key = sha256(entryFile + entry_mtime + pkg_mtime + src_max_mtime + config_hash)
 * Location: .drift/cache/ (fallback $TMPDIR/drift-cache/)
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { getProjectDir } from '../config/global';

let _noCache = false;

export function setNoCache(value: boolean): void {
  _noCache = value;
}

export function isNoCacheSet(): boolean {
  return _noCache;
}

/** Find cache directory: ~/.drift/projects/<slug>/cache/, fallback to $TMPDIR/drift-cache/ */
function getCacheDir(): string {
  const global = path.join(getProjectDir(), 'cache');
  try {
    mkdirSync(global, { recursive: true });
    return global;
  } catch {
    const fallback = path.join(os.tmpdir(), 'drift-cache');
    mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function getMtime(filePath: string): number {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function findPackageJson(entryFile: string): string | null {
  let dir = path.dirname(path.resolve(entryFile));
  const { root } = path.parse(dir);
  while (true) {
    const candidate = path.join(dir, 'package.json');
    if (existsSync(candidate)) return candidate;
    if (dir === root) return null;
    dir = path.dirname(dir);
  }
}

function hashString(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

export interface CacheKeyInput {
  entryFile: string;
  configHash?: string;
}

/** Walk directory tree for newest .ts/.tsx mtime. */
function getSourceMaxMtime(entryFile: string): number {
  const pkgJson = findPackageJson(entryFile);
  if (!pkgJson) return 0;
  const pkgDir = path.dirname(pkgJson);
  const srcDir = path.join(pkgDir, 'src');
  return walkMaxMtime(existsSync(srcDir) ? srcDir : pkgDir);
}

function walkMaxMtime(dir: string): number {
  let max = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        const sub = walkMaxMtime(path.join(dir, entry.name));
        if (sub > max) max = sub;
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const mt = getMtime(path.join(dir, entry.name));
        if (mt > max) max = mt;
      }
    }
  } catch {}
  return max;
}

function buildCacheKey(input: CacheKeyInput): string {
  const absEntry = path.resolve(input.entryFile);
  const entryMtime = getMtime(absEntry);
  const pkgJson = findPackageJson(absEntry);
  const pkgMtime = pkgJson ? getMtime(pkgJson) : 0;
  const srcMtime = getSourceMaxMtime(absEntry);
  const parts = [absEntry, String(entryMtime), String(pkgMtime), String(srcMtime)];
  if (input.configHash) parts.push(input.configHash);
  return hashString(parts.join('|'));
}

export interface CachedSpec {
  spec: unknown;
  entryFile: string;
  timestamp: number;
}

/** Get cached spec if valid. Returns null on miss. */
export function getCachedSpec(input: CacheKeyInput): CachedSpec | null {
  if (_noCache) return null;
  const key = buildCacheKey(input);
  const cacheFile = path.join(getCacheDir(), `${key}.json`);
  if (!existsSync(cacheFile)) return null;
  try {
    const raw = JSON.parse(readFileSync(cacheFile, 'utf-8'));
    return raw as CachedSpec;
  } catch {
    return null;
  }
}

/** Store spec in cache. */
export function setCachedSpec(input: CacheKeyInput, spec: unknown): void {
  if (_noCache) return;
  const key = buildCacheKey(input);
  const cacheDir = getCacheDir();
  const cacheFile = path.join(cacheDir, `${key}.json`);
  const data: CachedSpec = {
    spec,
    entryFile: path.resolve(input.entryFile),
    timestamp: Date.now(),
  };
  writeFileSync(cacheFile, JSON.stringify(data));
}

/** Get config file content hash (for cache key inclusion). */
export function getConfigHash(configPath: string | null): string | undefined {
  if (!configPath || !existsSync(configPath)) return undefined;
  try {
    const content = readFileSync(configPath, 'utf-8');
    return hashString(content);
  } catch {
    return undefined;
  }
}

/** Cache status info. */
export interface CacheStatus {
  dir: string;
  entries: number;
  totalBytes: number;
  oldest: number | null;
  newest: number | null;
}

/** Get cache status. */
export function getCacheStatus(): CacheStatus {
  const dir = getCacheDir();
  let entries = 0;
  let totalBytes = 0;
  let oldest: number | null = null;
  let newest: number | null = null;

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const fp = path.join(dir, f);
      const stat = statSync(fp);
      entries++;
      totalBytes += stat.size;
      const mt = stat.mtimeMs;
      if (oldest === null || mt < oldest) oldest = mt;
      if (newest === null || mt > newest) newest = mt;
    }
  } catch {}

  return { dir, entries, totalBytes, oldest, newest };
}

/** Clear all cached specs. */
export function clearCache(): number {
  const dir = getCacheDir();
  let removed = 0;
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      rmSync(path.join(dir, f));
      removed++;
    }
  } catch {}
  return removed;
}
