export { diffHashes, hashFile, hashFiles, hashString } from './hash';
export {
  CACHE_VERSION,
  type CachedDiagnostic,
  type CachedForgottenExport,
  type CacheContext,
  type CacheValidationResult,
  clearSpecCache,
  getSpecCachePath,
  loadSpecCache,
  SPEC_CACHE_FILE,
  type SpecCache,
  type SpecCacheConfig,
  saveSpecCache,
  validateSpecCache,
} from './spec-cache';
