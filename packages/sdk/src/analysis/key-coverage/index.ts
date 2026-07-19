/**
 * Docs-page key-coverage: deterministic gap/ghost/inversion detection between
 * a spec type's properties and the option keys a docs page documents.
 */

export {
  collectAllTypeKeys,
  collectTypeKeys,
  computeKeyCoverage,
  findTypeEntry,
  parseReplacement,
} from './diff-keys';
export { DEFAULT_SECTION_RE, extractDocumentedKeys } from './extract-keys';
export type {
  DocsKeyCorpus,
  DocumentedKeyLocation,
  KeyAnnotation,
  KeyCoverageOptions,
  KeyCoverageResult,
  KeyGap,
  KeyGhost,
  KeyInversion,
  KeyMeta,
} from './types';
