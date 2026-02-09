/**
 * Cached wrapper around SDK extract().
 * Check cache → hit: return cached → miss: extract, cache, return.
 */

import { extract } from '@openpkg-ts/sdk';
import { normalize, type OpenPkgSpec } from '@openpkg-ts/spec';
import { loadConfig } from '../config/loader';
import { getCachedSpec, getConfigHash, isNoCacheSet, setCachedSpec } from './spec-cache';

export interface CachedExtractResult {
  spec: OpenPkgSpec;
  cached: boolean;
}

/** Extract spec with caching. Returns normalized spec. */
export async function cachedExtract(entryFile: string): Promise<CachedExtractResult> {
  const { configPath } = loadConfig();
  const configHash = getConfigHash(configPath);
  const cacheKey = { entryFile, configHash };

  // Check cache
  if (!isNoCacheSet()) {
    const hit = getCachedSpec(cacheKey);
    if (hit) {
      return { spec: hit.spec as OpenPkgSpec, cached: true };
    }
  }

  // Miss — extract fresh
  const result = await extract({ entryFile });
  const spec = normalize(result.spec);

  // Store in cache
  setCachedSpec(cacheKey, spec);

  return { spec, cached: false };
}
