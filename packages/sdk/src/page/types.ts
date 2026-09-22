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
  type:
    | SpecDocDrift['type']
    | 'key-gap'
    | 'key-ghost'
    | 'key-inversion'
    | 'spec-not-in-claims'
    | 'prose-unknown-key'
    | 'prose-arity-mismatch'
    | 'prose-missing-required'
    | 'prose-literal-type-mismatch'
    | 'prose-param-mismatch'
    | 'prose-declared-key';
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
 * calls (`const t = new Foo(); t.start()`) count as mentioned, including when
 * the binding is in an earlier fence. A binding from a call whose spec return
 * type is a spec type (`const room = client.joinRoom()`) counts like `new Room()`.
 * Under a heading that names type T, a backticked `member` or `member(...)`
 * or `.member` / `.member()`, and fence `x.member` / `x.member(`, count as
 * `T.member`. A fence that prints `interface T { ... }` / `type T = { ... }` /
 * `class T { ... }` mentions every key its body declares. The gap locator is
 * the heading that names the type, not the page title.
 *
 * `prose-declared-key` (`kind: 'fence'`, locator = the member line) is a key
 * such a printed body declares that the spec's T does not have, when the
 * declaration is the spec's (`export`ed, under a heading that names T, or T
 * is the page's docs-map type). Silent on an open or memberless spec shape
 * (same closed-shape test as `prose-unknown-key`) and on `_`-prefixed keys.
 *
 * `kind: 'prose'` is inventory for a judge: a sentence / list item / table
 * cell that names an export or `Type.member`. No rule. Scan/CI ignore it.
 *
 * Fence call-site rules (`prose-unknown-key`, `prose-arity-mismatch`,
 * `prose-missing-required`, `prose-literal-type-mismatch`) fire only when the
 * callee resolves to an export.
 * Unknown receiver = no claim. Type arguments are not arguments. A fence that
 * prints a signature (`name: Type` params, `): ReturnType`) is not a call.
 * An argument list that is only a comment or `...` is an elision: no arity
 * or missing-required claim. An object literal whose body carries an elision
 * marker (a `...` / `…` comment, a bare `…` line, a spread) or a JSX tag with `{...props}`
 * is a partial sample: no missing-required, but a written key is still judged. `import * as ns from '<pkg>'` is a namespace
 * alias, never a missing export; `ns.member` is checked as the export
 * `member`. A receiver is a spec type only through a visible binding
 * (`new T()`, a typed return, `: T`, an import) — not because its name
 * matches. Bare callees in a fence that imports another library, or under
 * a Change this / Before / Previous heading or comment, are not claims.
 * `prose-unknown-key` matches an object literal to the parameter at that
 * position and fires only when that parameter's type is a closed object
 * shape (intersection = union of arms; interface = own keys plus `extends`;
 * any external/unresolved/generic arm opens the shape). JSX props are the
 * top-level properties of the component's first parameter (or the
 * destructured param names); nested JSX elements are each checked.
 *
 * `prose-literal-type-mismatch` (locator = the literal) is a string / number /
 * boolean literal (a template without substitutions is a string) passed where
 * every overload that takes that many arguments declares exactly another
 * primitive, `| undefined` / `| null` aside. Also a literal property value of
 * an object literal against a closed parameter shape, and a JSX attribute
 * (`count="5"` against `count: number`). A union, a literal union, a generic,
 * `any` / `unknown`, a brand, a format, an unresolved type: no claim.
 *
 * `prose-param-mismatch` (`kind: 'table-key'`, locator = the key cell) checks
 * a parameter table (first header cell Param / Parameter / Argument / Arg /
 * Name / Prop / Property / Option) or a `## Parameters` bullet list against
 * the signatures of the one callable export its section heading names. A row
 * key that is no parameter in any overload (or, for Prop / Option tables and
 * `options.x` rows, no property of a closed parameter type) is a claim; so is
 * a `string | number | boolean` Type cell that contradicts a primitive spec
 * type. Silent on generic / open / unresolved parameter types, `...rest` or
 * prose rows, tables of exports, a heading that names several exports or
 * none, and names the page itself uses in the export's signature.
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
  /**
   * Module specifier whose fence imports are checked (`prose-broken-reference`).
   * Defaults to `packageName`. When the spec is a `package.json` `exports`
   * subpath (entry `src/vanilla/utils.ts` → `jotai/utils`), pass that specifier
   * so imports from the package root and other subpaths are silent.
   */
  importSpecifier?: string;
  /**
   * Secondary entries of the same package, for a page that documents several
   * (`zod` and `zod/mini` tabs; SWR client and react-server). Precision-first:
   * - a reference (`ns.member`, a named import) the primary spec lacks but a
   *   secondary has is not a `prose-broken-reference`;
   * - a fence that imports a secondary's `importSpecifier` and not the
   *   primary's is checked against that spec for every rule. Claims keep their
   *   shape: a `specRef` does not say which spec it was resolved in;
   * - a fence that imports neither does not say which entry it means: nothing
   *   is judged through a name the entries give different signatures
   *   (parameters, return type or members), and a deprecated export is flagged
   *   only if every entry that has it deprecates it.
   * Omitted or empty = one spec, exactly as before.
   */
  alsoSpecs?: SecondarySpec[];
};

/** A secondary entry of the package a page documents, beside the primary `spec`. */
export type SecondarySpec = {
  spec: ApiSpec;
  registry: ExportRegistry;
  /** Module specifier of this entry (`zod/mini`). Without it no fence selects the entry. */
  importSpecifier?: string;
};

/** Inputs for `buildPageDocuments`. */
export type BuildPageDocumentsOptions = Omit<BuildPageDocumentOptions, 'file' | 'content'> & {
  files: Array<{ file: string; content: string }>;
};
