/**
 * Cached wrapper around SDK extract().
 * Check cache → hit: return cached → miss: extract, cache, return.
 */

import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { extract } from '@openpkg-ts/sdk';
import { normalize, type OpenPkg } from '@openpkg-ts/spec';
import { loadConfig } from '../config/loader';
import { getCachedSpec, getConfigHash, isNoCacheSet, setCachedSpec } from './spec-cache';

export interface CachedExtractResult {
  spec: OpenPkg;
  cached: boolean;
}

/** Walk from the entry file to the nearest package.json `name`. */
export function packageNameFromEntry(entryFile: string): string | undefined {
  let dir = path.dirname(path.resolve(entryFile));
  while (true) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const name = JSON.parse(readFileSync(pkgPath, 'utf-8')).name;
        if (typeof name === 'string' && name) return name;
      } catch {
        // keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Extract spec with caching. Returns normalized spec. */
export async function cachedExtract(entryFile: string): Promise<CachedExtractResult> {
  const resolved = path.resolve(entryFile);
  const { configPath } = loadConfig();
  const configHash = getConfigHash(configPath);
  const cacheKey = { entryFile: resolved, configHash };

  // Check cache
  if (!isNoCacheSet()) {
    const hit = getCachedSpec(cacheKey);
    if (hit) {
      return { spec: hit.spec as OpenPkg, cached: true };
    }
  }

  // Miss — extract fresh. Resolve the entry so OpenPkg walks from an absolute
  // dir (relative `src/index.ts` otherwise names the spec after `src`).
  const result = await extract({ entryFile: resolved });
  const spec = normalize(result.spec);
  const pkgName = packageNameFromEntry(resolved);
  if (pkgName) spec.meta = { ...spec.meta, name: pkgName };

  // Store in cache
  setCachedSpec(cacheKey, spec);

  return { spec, cached: false };
}
