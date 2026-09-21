/**
 * Page-level claims document for host docs sites.
 *
 * `@driftdev/sdk` stays a primitive: claims + rules + spec slices. A separate
 * review product paints and judges. Jev is not in this package. `kind: 'prose'`
 * candidates are sentence spans for a judge; fence call-site rules
 * (`prose-unknown-key`, `prose-arity-mismatch`, `prose-missing-required`) and
 * the parameter-table rule (`prose-param-mismatch`) are deterministic. Scan/CI
 * do not consume this document.
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
  SecondarySpec,
  SourcePos,
  SpecRef,
  SpecSlice,
} from './types';
