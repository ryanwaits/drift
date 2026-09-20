import type { ApiSpec } from '../analysis/api-spec';
import type { ExportRegistry, SpecDocDrift } from '../analysis/drift/types';
import type { KeyAnnotation } from '../analysis/key-coverage/types';

/** How a claim was found on the page. */
export type ClaimKind = 'fence' | 'heading' | 'inline' | 'table-key' | 'prose' | 'gap';

/** 1-indexed source position in the markdown file. */
export type SourcePos = {
  line: number;
  col: number;
};

/**
 * Source-markdown coordinates for a claim. Address space is the file, not the
 * rendered DOM. `headingId` is a GitHub/Fumadocs slug of the nearest heading.
 * `headingText` is the unwrapped heading as written ("Empty session"), never
 * the slug ("empty-session").
 */
export type Locator = {
  /** Repo-relative markdown path (git root when present, else cwd) */
  path: string;
  start: SourcePos;
  end: SourcePos;
  headingId?: string;
  headingText?: string;
};

/** Slice of the spec a claim cites. */
export type SpecRef = {
  export: string;
  member?: string;
  signature?: string;
  deprecated?: boolean;
  deprecationNote?: string;
  /** From JSDoc / registry note when parseable */
  replacement?: string;
};

/** Deterministic detector hit. Absent when the claim is inventory only. */
export type RuleHit = {
  type: SpecDocDrift['type'] | 'key-gap' | 'key-ghost' | 'key-inversion' | 'spec-not-in-claims';
  issue: string;
  suggestion?: string;
};

/**
 * One documented (or missing) mention of the spec on a page.
 *
 * `candidate: true` is inventory — a name/heading/backtick mention with no
 * rule. Scan/CI ignore it. `rule` is present iff a deterministic detector fired.
 *
 * `spec-not-in-claims` is a rule only when this page is on the hook for that
 * type: a `docsMap` row, or a heading that names the type or one of its
 * members. Citing `Room` in a fence or backtick is a candidate, never a gap.
 * Private/`_` members and docs-map `internal` keys are never gaps. Instance
 * calls (`const t = new Foo(); t.start()`) count as mentioned. The gap locator
 * is the heading that names the type, not the page title.
 */
export type Claim = {
  /** Stable: `${path}:${kind}:${export}.${member}:${start.line}` */
  id: string;
  kind: ClaimKind;
  /** Exact span text */
  text: string;
  locator: Locator;
  /** Null only for unmatched ghosts */
  specRef: SpecRef | null;
  rule?: RuleHit;
  candidate?: boolean;
};

/** Unique specRef cited by claims on this page, plus a compact body. */
export type SpecSlice = SpecRef & {
  /** Compact signature text; same facts as `drift get`, not a second renderer */
  body?: string;
};

/**
 * Headless page document for a host docs site (or a separate review product).
 * Not a review UI. Jev is not in this package.
 */
export type PageDocument = {
  $schema?: string;
  packageName: string;
  path: string;
  title?: string;
  claims: Claim[];
  slices: SpecSlice[];
};

/** Committed page→type rows. One join path for spec-not-in-claims (the other is a heading that names the type/member). Also drives option-table key-gaps. */
export type PageDocsMapPage = {
  page: string;
  type: string;
  sectionRe?: string;
  internal?: string[];
  deprecated?: string[];
  replacements?: Record<string, string>;
  annotations?: Record<string, KeyAnnotation>;
};

/** Minimal docs-map shape consumed by `buildPageDocument`. */
export type PageDocsMap = {
  pages: PageDocsMapPage[];
};

/** Inputs for `buildPageDocument`. */
export type BuildPageDocumentOptions = {
  spec: ApiSpec;
  registry: ExportRegistry;
  /** Repo-relative markdown path */
  file: string;
  content: string;
  docsMap?: PageDocsMap;
  /** Override `spec.meta.name` for prose import checks */
  packageName?: string;
};

/** Inputs for `buildPageDocuments`. */
export type BuildPageDocumentsOptions = Omit<BuildPageDocumentOptions, 'file' | 'content'> & {
  files: Array<{ file: string; content: string }>;
};
