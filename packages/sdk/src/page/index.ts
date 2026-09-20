/**
 * Page-level claims document for host docs sites.
 *
 * `@driftdev/sdk` stays a primitive: claims + rules + spec slices. A separate
 * review product paints and judges. Jev is not in this package.
 *
 * @example
 * ```ts
 * import { buildExportRegistry, buildPageDocument } from '@driftdev/sdk';
 *
 * const registry = buildExportRegistry(spec);
 * const page = buildPageDocument({
 *   spec,
 *   registry,
 *   file: 'docs/sdk-reference.md',
 *   content,
 * });
 * ```
 *
 * @module page
 */

export { buildPageDocument, buildPageDocuments } from './build';
export type {
  BuildPageDocumentOptions,
  BuildPageDocumentsOptions,
  Claim,
  ClaimKind,
  Locator,
  PageDocsMap,
  PageDocsMapPage,
  PageDocument,
  RuleHit,
  SourcePos,
  SpecRef,
  SpecSlice,
} from './types';
