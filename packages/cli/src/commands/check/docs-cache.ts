/**
 * Cache infrastructure for external docs sources
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDoccovDir } from '@doccov/sdk';

export interface DocsCacheOptions {
  cwd: string;
  ttl?: number; // TTL in milliseconds, default 1 hour
}

export interface CacheEntry {
  content: string;
  fetchedAt: number;
  source: string;
}

const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get the cache directory path (uses project root)
 */
export function getCacheDir(cwd: string): string {
  return path.join(getDoccovDir(cwd), 'cache');
}

/**
 * Get cache subdirectory for source type
 */
export function getCacheSubdir(cwd: string, type: 'urls' | 'github' | 'gitlab'): string {
  return path.join(getCacheDir(cwd), type);
}

/**
 * Ensure cache directory structure exists
 */
export function ensureCacheDir(cwd: string): void {
  const subdirs = ['urls', 'github', 'gitlab'] as const;

  for (const subdir of subdirs) {
    const dir = getCacheSubdir(cwd, subdir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Generate a safe filename from a cache key
 */
export function getCacheFilename(key: string): string {
  const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  const sanitized = key.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50);
  return `${sanitized}_${hash}.json`;
}

/**
 * Get cached content if valid
 */
export function getFromCache(
  cwd: string,
  type: 'urls' | 'github' | 'gitlab',
  key: string,
  ttl: number = DEFAULT_TTL,
): CacheEntry | null {
  const cacheFile = path.join(getCacheSubdir(cwd, type), getCacheFilename(key));

  if (!fs.existsSync(cacheFile)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as CacheEntry;

    // Check TTL
    if (Date.now() - data.fetchedAt > ttl) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Write content to cache
 */
export function writeToCache(
  cwd: string,
  type: 'urls' | 'github' | 'gitlab',
  key: string,
  content: string,
): void {
  ensureCacheDir(cwd);

  const cacheFile = path.join(getCacheSubdir(cwd, type), getCacheFilename(key));
  const entry: CacheEntry = {
    content,
    fetchedAt: Date.now(),
    source: key,
  };

  fs.writeFileSync(cacheFile, JSON.stringify(entry, null, 2));
}

/**
 * Clear all cached docs
 */
export function clearDocsCache(cwd: string): void {
  const cacheDir = getCacheDir(cwd);
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(cwd: string, ttl: number = DEFAULT_TTL): number {
  const cacheDir = getCacheDir(cwd);
  if (!fs.existsSync(cacheDir)) {
    return 0;
  }

  let cleared = 0;
  const subdirs = ['urls', 'github', 'gitlab'] as const;

  for (const subdir of subdirs) {
    const dir = getCacheSubdir(cwd, subdir);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(dir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CacheEntry;
        if (Date.now() - data.fetchedAt > ttl) {
          fs.unlinkSync(filePath);
          cleared++;
        }
      } catch {
        // Remove invalid cache files
        fs.unlinkSync(filePath);
        cleared++;
      }
    }
  }

  return cleared;
}
