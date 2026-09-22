# SDK

Package: `@driftdev/sdk`. Use it to integrate drift analysis into your own tools programmatically.

## Who This Is For

- Teams building custom docs tooling or CI/reporting workflows.
- Platform engineers embedding Drift checks in internal automation.
- Agents/services that need structured docs diagnostics.

## Why Use The SDK

- Compose Drift primitives directly in your own pipeline.
- Get richer control than the CLI surface for advanced workflows.
- Reuse one analysis engine across local tools, CI, and services.

## Install

```bash
bun add @driftdev/sdk
```

## Core API

### `Drift` -- Spec Extraction

Extract a typed API spec from a TypeScript entry point:

```typescript
import { Drift } from '@driftdev/sdk';

const drift = new Drift();
const result = await drift.analyzeFileWithDiagnostics('src/index.ts');
const spec = result.spec;

console.log(`${spec.exports.length} exports found`);
```

Same extract as `drift page` / CLI scan: OpenPkg stubs non-workspace packages. Pass `resolveExternalTypes: true` only to opt into OpenPkg `followExternal: true` (full expansion of every dependency).

Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `resolveExternalTypes` | `boolean` | unset | OpenPkg `followExternal`. Unset = stub non-workspace packages (safe). `true` expands every dependency |
| `maxDepth` | `number` | `4` | Max depth for type resolution |
| `useCache` | `boolean` | `true` | Use spec cache |

### `computeDrift` -- Drift Detection

Cross-reference JSDoc against code signatures:

```typescript
import { Drift, computeDrift } from '@driftdev/sdk';

const drift = new Drift();
const { spec } = await drift.analyzeFileWithDiagnostics('src/index.ts');

const result = computeDrift(spec);

for (const [exportName, drifts] of result.exports) {
  for (const drift of drifts) {
    console.log(`${exportName}: ${drift.issue}`);
    // drift.type     -- e.g. 'param-mismatch', 'return-type-mismatch'
    // drift.target   -- affected parameter/property name
    // drift.expected -- what JSDoc says
    // drift.actual   -- what code says
    // drift.filePath -- source file
    // drift.line     -- line number
  }
}
```

The `DriftResult.exports` is a `Map<string, SpecDocDrift[]>`.

### `buildExportRegistry` -- Export Registry

Build a lookup table of all exports for cross-reference validation:

```typescript
import { buildExportRegistry } from '@driftdev/sdk';

const registry = buildExportRegistry(spec);

// Check if an export exists
registry.all.has('parseConfig');      // true/false
registry.exports.has('parseConfig');  // true/false (exports only)
registry.types.has('Config');         // true/false (types only)
registry.localNames?.get('useSWR');   // 'default': source name of the default export, never in `all`
```

### `detectProseDrift` -- Markdown Drift

Scan markdown files for broken import references:

```typescript
import { buildExportRegistry, detectProseDrift, discoverMarkdownFiles } from '@driftdev/sdk';

const registry = buildExportRegistry(spec);
const markdownFiles = discoverMarkdownFiles(process.cwd(), {
  include: ['README.md', 'docs/**/*.md'],
  exclude: ['node_modules/**'],
});

const issues = detectProseDrift({
  packageName: '@my-scope/my-lib',
  markdownFiles,
  registry,
  spec, // optional: types destructured bindings (`const { room } = useRoom()`) and call chains
});

for (const issue of issues) {
  console.log(`${issue.filePath}:${issue.line} -- ${issue.issue}`);
  if (issue.suggestion) console.log(`  ${issue.suggestion}`);
}
```

### `buildPageDocument` -- Host JSON

Page-level claims for a docs host (Vercel, Mintlify, Fumadocs, or a separate review product). Coordinates are source markdown (`line` + `col` + heading slug), plus a spec slice. Not a review UI. Jev is not in this package. `candidate` claims are inventory; only `rule` hits are the existing detectors. Scan/CI do not consume this document.

`spec-not-in-claims` is a rule only when the page is on the hook for that type: a `drift.docs.json` row, or a heading that names the type or a member. Mentioning a type in a fence or backtick is a candidate, never a gap dump. Private/`_` members and map `internal` keys are never gaps. Instance calls on `new Type()` count as mentioned, including when the binding is in an earlier fence on the page. A binding from a call whose spec return type is a spec type (`const room = client.joinRoom()`) counts like `new Room()`. Under a heading that names type T, a backticked `member` or `member(...)`, and fence `x.member` / `x.member(`, count as `T.member`. The gap locator is the heading that names the type. `locator.headingText` is the written heading, not the slug. A `#` line inside a fenced code block (backtick or tilde fence, any info string, indented in a list; closed only by its own marker, at least as long, with no info string) is never a heading, so a bash `# install` comment does not re-scope the claims after it or shift slugs; every line scanner (headings, prose, parameter tables, key tables) shares that fence test. `locator.path` is repo-relative. Bare member names that exist on more than one type resolve through heading ancestors; no specRef if none of those headings names a candidate type.

`kind: 'prose'` candidates are sentence / list-item / table-cell spans that name an export or `Type.member`. No rule — scan/CI ignore them. Bare-word match only for camelCase with an inner capital (`useSWR`), PascalCase with 2+ humps (`ZodType`, `SWRConfig`), or snake_case. Dictionary-plain names (`Room`, `atom`), names that only carry a digit (`base64`, `utf8`, `sha256`, `h1`) and acronyms (`JSON`, `URL`) are English until backticked, and a bare word right after a dot (`schema.safeParse`) is a member, not the export `safeParse`.

Names that are not the export they spell (all claim kinds: backticked, bare, heading, table key):

- The word `default` never names the default export. The default export answers to its source name instead: OpenPkg's `localName` (`useSWR` for `export default useSWR`; `name` stays `"default"`). Backticked or bare `useSWR`, a `## useSWR` heading, a `useSWR` table key, and a fence call `useSWR(...)` on a page that imports that name from nowhere all resolve to `specRef: { export: 'default' }` and are checked against its overloads. A visible default import under another local name (`import swr from 'swr'`) still binds that local; the name imported from another module, or declared in the fence, is not the export. `buildExportRegistry(spec).localNames` maps `useSWR` to `default` for consumers; it is never in `registry.all`, so `import { useSWR } from 'swr'` stays a `prose-broken-reference` (suggestion: `'useSWR' is the default export: import useSWR from 'swr'`).
- A leading dot names a member or nothing, never a top-level export: `` `.meta()` `` resolves to `Type.meta` through the heading ancestors that name a type, else the one type that has the member, else the one ancestor every owner inherits it from (OpenPkg's `inheritedFrom` on members; an alias `type Schema = ZodType<...>` or an `extends` chain counts as its target). Several unrelated owners, or none: no claim. A namespace's function (`util.extend`) is not a `.extend()` owner. With no heading to go by, only owners on the public surface count: a type is public when it is in `spec.exports` (any kind) or an export's signature declares it as a parameter or return type by `$ref`; a name starting with `$` or `_` never is. zod's `$ZodTypeInternals.parse` does not make `` `.parse()` `` ambiguous: it is `ZodType.parse`. When no owner is public the remaining (non-`$`/`_`) owners are judged as before.
- A JS/TS builtin type or global name is the language's, not the package's export of the same name: `number`, `string`, `boolean`, `bigint`, `symbol`, `object`, `null`, `undefined`, `void`, `never`, `any`, `unknown`, `function`, `array`, `map`, `set`, `date`, `promise`, `record`, `tuple`, `enum`, `json`, `error`, `regexp`, `Number`, `String`, `Boolean`, `Object`, `Array`, `Map`, `Set`, `Date`, `Promise`, `Error`, `RegExp`, `Symbol`, `BigInt`, `JSON`, `Function` (case-sensitive). It names the export only in call form (`` `number()` ``, `` `string({ min: 1 })` ``), qualified (`` `z.number` ``, `` `z.number()` ``, `zod.number`), as a heading that is one code span or a call (`` ## `number` ``, `## number()`), or in a fence (import or call site, unaffected). Two more places make a backticked bare builtin name the export (an export of that exact name only, never a member): an API reference section for it, i.e. a heading ancestor that is exactly that name as a code span or a call (`` ## `string` ``, `### string()`), or the page's H1 / frontmatter `title` in any form (`# string`, `title: string`), where `` `string` `` is the export and `` `number` `` still the language's; and, anywhere, the word right after the code span being one of schema, function, action, method, hook, component, API, export, util, utility, helper ("Valibot's own `` `string` `` schema", "the `` `pipe` `` method"; not "`` `number` `` type" or "`` `object` `` schemas").
- A name qualified by the page's namespace alias (`import * as z`), the package name, or a member-less `namespace` export is that export or nothing: `` `z.strictObject` `` is `specRef: { export: 'strictObject' }`, never `{ export: 'z', member: 'strictObject' }`, and `z.nope` is no claim.

Fence call-site rules (PageDocument only, not scan): `prose-unknown-key` (JSX prop / object-literal key not on the closed object type of the parameter at that position; no claim for `T` / `Partial<T>` / `Record` / index signatures; intersection keys are the union of every arm, interface keys include `extends`, and any external/unresolved/generic arm opens the shape), `prose-arity-mismatch` (more positional args than any overload; a printed signature is not a call), `prose-missing-required` (required in every overload; JSX `children` counts; an argument list that is only a comment or `...` is an elision; a zero-argument call that is a whole expression statement, chained or not (`z.map();`, `z.map().optional();`), names the API and is not a call, while `const m = z.map()`, `foo(z.map())`, `return z.map()`, `await z.map();` and JSX still fire). A rest parameter is never required and lifts the arity bound for its overload, whatever the spec's `required` says: `rest: true`, a name emitted as `...args`, or a trailing parameter named `args` / `rest` that is not typed as a named or inline object (what `(...args) =>` extracts to when the rest marker is dropped). A bare callee the fence declares itself (`const { useStore } = createContext()`, a function, a parameter) is not the export of the same name. Neither is one an EARLIER fence of the page declared at its top level (`const|let|var|function|class`, destructured or `export`ed too), whatever the initializer: after `const useStore = create(...)`, a later fence's `useStore(selector)` is the reader's bound hook, so no call-site rule, no binding from it (`const api = useStore()` types nothing), no deprecated flag and no inventory claim. A fence that imports the name from the package (`import { useStore } from 'zustand'`) rebinds it to the export from that fence on. A declaration nested in a function body is not page scope, and a printed signature (`function useStore(api: S): T` with no body, `declare ...`) is the export's own declaration, not a shadow. `prose-literal-type-mismatch` (locator = the literal; issue "Argument 1 of 'useOthersOnLocation' is a string literal; the spec declares 'locationId: number'") is a string / number / boolean literal (a template without substitutions is a string; `-5` is a number) where every overload that takes that many arguments declares exactly another primitive at that position, `| undefined` / `| null` / optional aside. The same check runs per literal property value of an object-literal argument against a closed parameter shape ("Property 'count' of argument 1 of ...") and per JSX attribute (`<C count="5" />` against `count: number` fires, `<C count={5} />` does not). Silent on a union that is more than one type, a literal union (`enum` / `const`), a format, a brand (`allOf`), a generic, `any` / `unknown`, an unresolved `$ref`, a rest parameter, and any call with a spread argument. JSX props are the component's top-level props, not nested property types. Every JSX element in the fence that resolves to an export is checked. Type arguments are not arguments (`foo<A, B>()` is zero args). Unknown receiver = no claim. `prose-unresolved-member` only for class/interface receivers with a closed member list (mapped `Snapshot<T>` / conditional `ExtractState<S>` are the reader's), and only through a visible binding — not a name that happens to match. Its claim has `specRef: null` (the receiver's type has no such member; it is never cited on another type that happens to have one) and suggests only members of the receiver's own type. Bindings: `const x = call()` / `await call()` / `ns.call()` / `new T()` binds `x` to the spec return type (`Promise<T>` unwrapped, `$ref` or OpenPkg's `x-ts-type: 'Promise'`). A destructured element is never the return type: `const { a } = call()`, `{ a: b }`, `{ a = 1 }` bind the local to the type of property `a`, and `const [a, b] = call()` to tuple positions (`prefixItems`), only when that is a spec class/interface with a closed member list (`T | null | undefined` counts as `T`; every overload must agree); otherwise the name is unbound and shadows an earlier binding. Rest elements, nested patterns and computed keys are unbound. `import * as v from 'valibot'` is a namespace alias (never a missing export); `v.member` is the export `member`, and `v.nope` is a `prose-broken-reference` only through that import: a receiver bound by an import from another package (`import { z } from 'zod'`; `z.string()`) is foreign and never a claim, and one the page never imports at all is an inferred alias that resolves references but carries no claim. A fence that imports another library, or sits under Change this / Before / Previous, is not a claim. Under a heading that names T, a backticked `.member()` counts as `T.member`.

Every fence claim (call-site rules, JSX, `prose-unresolved-member`, `prose-broken-reference`, `prose-deprecated-reference`) is located inside its own fence: the exact line and column of the call expression, opening JSX tag, or import specifier in the source markdown, indentation of a fence in a list item included; a multi-line call ends on its closing paren. The same text earlier in prose or in another fence is never the locator, the same call twice in a fence is two claims, and a span that cannot be found inside the fence is no claim. Fence inventory (`candidate`, `kind: 'inline'`) follows the same rule: one claim per (fence, export), on the referencing token inside that fence: the callee of the first `name(...)` / `new name(...)` (a printed signature counts) or of the first `ns.name(...)` through a namespace alias (the imported `import * as z`, or the page's conventional alias when no import is shown: the same aliases the call-site rules use), with `text` as written (`z.string`, `specRef: { export: 'string' }`), else the named import. A chained member is a mention too when the chain resolves through spec return types alone: `z.string().email().min(5)` yields `{ export: 'ZodString', member: 'email' }` and `{ export: 'ZodString', member: 'min' }`, each on its member token (first overload, no explicit type arguments, `this` stays the receiver, only members the resolved type has); the chain ends at the first link the spec does not type, and a variable receiver (`schema.parse()`) is not a chain. An import from another library, a name the fence or an earlier fence declares, and the namespace import itself (`import * as z`) are not mentions. Prose candidates keep their sentence locators.

`prose-broken-reference` checks imports whose specifier equals `packageName`. When the spec is a `package.json` `exports` subpath, pass `importSpecifier` (`jotai/utils`) so imports from the package root and other subpaths are silent. `buildPageDocuments` forwards every shared option (`importSpecifier`, `packageName`, `docsMap`) to each page. An aliased import is checked by its imported name: `import { useSnapshot as useSnap }` is a claim about `useSnapshot`, located on that name, and later `useSnap(...)` call sites resolve to `useSnapshot`. A default import (`import x from`, `import { default as x }`, `import x, { y }`) is never a `prose-broken-reference`. It binds the local to the export named `default` when the spec has one, across fences like any alias: `useSWR(...)` call sites are checked against every overload of `default` (the issue names the local: `Call 'useSWR' ...`), and the first call in each fence is a `candidate` claim with `specRef.export: 'default'`, located on the callee (calls through a renamed named import get the same mention). With no `default` export in the spec the local resolves to nothing: silent, never matched to an export that shares its name. `import { create: actualCreate }` is not import syntax; the claim says so ("`create: actualCreate` is not valid import syntax; did you mean `create as actualCreate`?", `suggestion` = the alias), is located on the pair, and the pair is read as the alias it stands for, so `create` is still checked and `actualCreate(...)` still resolves to it.

A type reference (`$ref: '#/types/<X>'`, a return-type name, a docs-map `type`) resolves by spec `id` first, then by `name` when only one declaration has it (an export and its referenced-types variant share an id and still merge). OpenPkg gives same-named types distinct ids (`Options`, `react.Options`): `#/types/Options` is the entry with that id, so another `Options`' keys are `prose-unknown-key`; `#/types/react.Options` is checked against that one; several same-named declarations with no id match are unresolved, which reads as an open shape: no claim, never a merge of their keys. Exports still resolve by `name` or `id`. In JSDoc type drift a qualified id is the type the docs name: `@param {Options}` matches `#/types/react.Options`.

One page, several entries of the same package (`zod` and `zod/mini` tabs, SWR client and react-server): pass the others as `alsoSpecs: Array<{ spec: ApiSpec; registry: ExportRegistry; importSpecifier?: string }>` (type `SecondarySpec`; also on `buildPageDocuments` and `detectProseDrift`). Precision-first:

- A reference (`ns.member`, a named import) the primary spec lacks but any secondary has is not a `prose-broken-reference`.
- A fence that imports a secondary's `importSpecifier` and not the primary's (`import * as z from "zod/mini"`) is checked against that spec for every rule, with its own bindings and namespace aliases; its inventory mentions (bare, `ns.name(...)` and chained members) are that entry's exports and types. Claims keep their shape: a `specRef` does not say which spec resolved it (`signature` and `slices` come from that spec).
- A fence that imports neither does not say which entry it means: nothing is judged through an export the entries give different signatures (parameters, return type or members): no call-site rule on it, no binding from it, so no member rule behind it. A deprecated export is flagged there only if every entry that has it deprecates it. Exports with identical signatures are checked as usual. Inventory mentions there are the primary's; a chained member is cited only when no other entry types the same chain with that member (`z.string().min(5)` is `ZodString.min` because `ZodMiniString` has no `min`; `z.string().parse(x)` is on both, so no member claim).
- Omitted or empty = one spec, exactly as before.

```typescript
const page = buildPageDocument({
  spec,
  registry,
  file: 'docs/api.mdx',
  content,
  alsoSpecs: [{ spec: mini, registry: buildExportRegistry(mini), importSpecifier: 'zod/mini' }],
});
```

`prose-deprecated-reference` judges the resolved reference, never a bare name. `f(...)`, `ns.f(...)`, a named import and a bare callee are the top-level export `f`: deprecated only if that export is (`z.url()` is never the deprecated method `ZodString.url`; a deprecated `z.cuid()` is a hit). A member is a hit only when the call resolves to `Type.member` through a binding (`new T()`, a call whose spec return type is T, an annotated `: T`) or a chain of spec return types (`z.string().url()`, `z.string().min(5).url()` where `min` returns `this`; first overload, no explicit type arguments); an unknown receiver or an unresolved link is silent, even when only one type has that member. The claim's `specRef` is the owning `Type.member` and the issue names it (`'ZodString.url'`); `SpecDocDrift.owner` carries the type. It is silent when the section the fence sits in owns up to the deprecation: it says deprecated / "no longer maintained" / "no longer supported" / legacy (case-insensitive), or names the replacement from the `@deprecated` note. The section is the nearest heading's whole section (subsections included), plus the intro under each enclosing heading, plus frontmatter; a fence directly under the H1 or before any heading takes the whole page. A note in a sibling section does not count. The claim is located on the import, not the first place the name appears on the page.

`prose-param-mismatch` (PageDocument only, `kind: 'table-key'`, locator = the key cell) checks parameter tables and `## Parameters` bullet lists against the signatures of the one export their section names. It is exact or silent:

- Table: first header cell is Param / Parameter / Argument / Arg (positional names) or Name / Prop / Property / Option (names, or properties of a closed parameter type), case-insensitive, optional plural. List: top-level bullets that start with a backticked name (after an optional `**optional**` marker) directly under a Parameters / Params / Arguments / Args heading; nested bullets are not rows.
- Owner: the nearest enclosing heading that names exactly one callable export (`name`, `name()`, `name<T>(a, b)`, `new Name(opts)`, `<Name>`, `Type.member()`), walking up only through headings that scope parameters (Parameters, Arguments, Props, Properties, Options, Config, API, API Reference, Reference, Usage, Signature, Syntax). Any other heading in between (Returns, prose, two exports) = no claim.
- Row key: first backticked token of the first cell, trailing `?` stripped. A key that is not a parameter name in any overload is a claim (`Parameter 'keyKey' is not a parameter of 'useLiveStateData'`, suggestion `Parameters: key`). `param.key` is checked against that parameter's closed object type; a literal `options.` / `props.` prefix against the closed object parameters. Prop / Option tables use the single closed object parameter's properties; a component's props are that type or its destructured parameter names.
- Primitive types only: a Type cell that is exactly `string`, `number`, or `boolean` against a spec parameter type that is exactly another of the three (`Parameter 'key' is documented as 'string', spec says 'number'`). Unions, generics, object types, links: no claim.
- Silent when: a parameter type that could carry the key is generic / open / unresolved (same closed-shape test as `prose-unknown-key`); any row is `...rest`; any row key is prose; a row key is another export (a table of hooks); the name is one the page itself uses for that parameter in a heading, fence, or inline signature of the export (`create(stateCreatorFn)` — a display name, not a rename); no row matches the spec (unless it is the single row of a one-parameter callable, or a Prop / Option table directly under a Props / Options heading).
- A rule hit replaces the rule-less `table-key` inventory claim on the same cell.

```typescript
import { buildExportRegistry, buildPageDocument } from '@driftdev/sdk';
// or: import { buildPageDocument } from '@driftdev/sdk/page';

const registry = buildExportRegistry(spec);
const page = buildPageDocument({
  spec,
  registry,
  file: 'docs/sdk-reference.md',
  content,
});
```

CLI: `drift page docs/sdk-reference.md --json`.

```json
{
  "packageName": "@stacks/clarinet-sdk",
  "path": "docs/sdk-reference.md",
  "title": "SDK reference",
  "claims": [
    {
      "id": "docs/sdk-reference.md:heading:Simnet.runSnippet:3",
      "kind": "heading",
      "text": "runSnippet",
      "locator": {
        "path": "docs/sdk-reference.md",
        "start": { "line": 3, "col": 4 },
        "end": { "line": 3, "col": 13 },
        "headingId": "runsnippet"
      },
      "specRef": { "export": "Simnet", "member": "runSnippet", "deprecated": true, "replacement": "execute" },
      "candidate": true
    }
  ],
  "slices": [{ "export": "Simnet", "member": "runSnippet", "body": "Simnet.runSnippet(command: string)" }]
}
```

### `generateReport` -- Full Report

Generate a coverage report from a spec:

```typescript
import { Drift, generateReport } from '@driftdev/sdk';

const drift = new Drift();
const { spec } = await drift.analyzeFileWithDiagnostics('src/index.ts');
const report = await generateReport(spec);

console.log(`Coverage: ${report.coverage.score}%`);
console.log(`Documented: ${report.coverage.documentedExports}/${report.coverage.totalExports}`);
console.log(`Drift issues: ${report.coverage.driftCount}`);
```

### `validateExamples` -- Example Validation

Validate `@example` blocks for presence, type-correctness, and runtime behavior:

```typescript
import { Drift, validateExamples } from '@driftdev/sdk';

const drift = new Drift();
const { spec } = await drift.analyzeFileWithDiagnostics('src/index.ts');

const result = await validateExamples(spec.exports, {
  validations: ['presence', 'typecheck'],
  packagePath: process.cwd(),
  exportNames: spec.exports.map(e => e.name),
});

console.log(`Examples present: ${result.presence?.withExamples}/${result.presence?.total}`);
if (result.typecheck) {
  console.log(`Typecheck: ${result.typecheck.passed} passed, ${result.typecheck.failed} failed`);
}
```

Validation levels: `'presence'`, `'typecheck'`, `'run'`. Not on the default CLI gate — static example-drift is inside `computeDrift`.

## Key Types

```typescript
import type {
  SpecDocDrift,          // A single drift issue
  DriftType,             // 'param-mismatch' | 'return-type-mismatch' | ...
  DriftCategory,         // 'structural' | 'semantic' | 'example' | 'prose'
  DriftResult,           // { exports: Map<string, SpecDocDrift[]> }
  DriftReport,          // Full coverage report
  CoverageSummary,       // Coverage stats
} from '@driftdev/sdk';
```

## Subpath Imports

The SDK also exposes subpath imports for specialized use:

```typescript
// Analysis utilities
import { generateReport } from '@driftdev/sdk/analysis';

// Type definitions
import type { DriftReport } from '@driftdev/sdk/types';
```

## Constants

```typescript
import { DRIFT_CATEGORIES, DRIFT_CATEGORY_LABELS } from '@driftdev/sdk';

// DRIFT_CATEGORIES maps DriftType -> DriftCategory
// e.g. DRIFT_CATEGORIES['param-mismatch'] === 'structural'

// DRIFT_CATEGORY_LABELS maps DriftCategory -> human label
// e.g. DRIFT_CATEGORY_LABELS['structural'] === 'Signature mismatches'
```
