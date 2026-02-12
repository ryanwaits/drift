export { diffHashes, hashFile, hashFiles, hashString } from './hash';
export {
  CACHE_VERSION,
  type CacheContext,
  type CachedDiagnostic,
  type CachedForgottenExport,
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
