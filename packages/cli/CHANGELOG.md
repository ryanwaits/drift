# @doccov/cli

## 1.19.0

### Patch Changes

- 2b4e46b: On OpenPkg 0.55.2: a type alias that only references another named type carries no members of its own, so its page is not asked to document the target's members.
- 89c6cca: Page accuracy from the vercel/ai docs audit (374 pages):

  - A heading joins a type for `spec-not-in-claims` only with evidence (code span / call form, page title, a fence that imports, constructs, calls or declares the export, or the docs map), and gaps dump only when the section documents the surface (declaration, parameter / option table, title or map). An option key in `new X({ tools })` mentions the member.
  - A bare backticked member (`` `schema` ``) resolves only within a type in scope: a heading ancestor, the frontmatter title or the docs-map type. Leading-dot members keep their owner walk.
  - New: `prose-unknown-key` in prose for "the `k` option" of an export whose options object is closed.
  - `prose-unresolved-member`: a chained receiver (`result.stream.pipeThrough()`) is judged on the property's spec type, or skipped.
  - JSX props from one object parameter the spec cannot close claim nothing; a self-`$ref` type export resolves to its full entry.
  - Diff fences (`diff`, or `+` / `-` marker lines) are read as their added code.
  - No `prose-broken-reference` under a heading or sentence that negates the API (`Removed`, `has been removed`).
  - Before/after migration detection: `Before` / `Previous` / `Old` / `Migrating from` headings, version labels (`v4`, `title="AI SDK 5"`) lower than another on the page; a before fence runs no reference or call-site rule.

- Updated dependencies [2b4e46b]
- Updated dependencies [89c6cca]
  - @driftdev/sdk@1.19.0

## 1.18.1

### Patch Changes

- 0e5430e: `prose-missing-required` also fires when a call satisfies none of the alternatives a spec requires (`one of prompt, messages`)
- 19e7ae1: On OpenPkg 0.55.1: a destructured union parameter keeps which keys a caller must pick between, so `generateText({ model })` is reported as needing one of `prompt`, `messages`.
- Updated dependencies [0e5430e]
- Updated dependencies [19e7ae1]
  - @driftdev/sdk@1.18.1

## 1.18.0

### Patch Changes

- a494c9f: On OpenPkg 0.55: a function that destructures one options object is one parameter, so `embed({ model, value })` is checked key by key instead of being read as one positional argument.
- ff7bade: Page documents: a receiver bound by an import from another package (`import { z } from 'zod'`; `z.string()`) is foreign and never a `prose-broken-reference`, whatever this package exports; a `ns.member` broken reference stands only on an explicit `import * as ns` of the package, never on an inferred alias. A fence that prints `interface X { ... }` / `type X = { ... }` / `class X { ... }` mentions every key its body declares (no `spec-not-in-claims` for them). New rule `prose-declared-key` (`RuleHit['type']`): a key such a printed body declares that the spec's X does not have (`'args' is not a member of 'ToolCallPart'`), silent on open or memberless spec shapes. An object literal whose body carries an elision marker (`// ...`, `/* ... */`, `…`, a spread) is a partial sample: no `prose-missing-required` on it, while a key it does write is still `prose-unknown-key`.
- Updated dependencies [a494c9f]
- Updated dependencies [ff7bade]
  - @driftdev/sdk@1.18.0

## 1.17.0

### Patch Changes

- 858e548: The SDK no longer depends on `zod`. `drift.config.json` is validated by a small hand-written checker with the same accepted shape. `driftConfigSchema` is kept as a plain `{ parse(input) }` object (no longer a zod schema; `parse` throws a plain `Error` naming the bad path) and `parseDriftConfig` is exported alongside it; `normalizeConfig` is unchanged. Consumers that only build page documents no longer load zod at startup.
- Updated dependencies [858e548]
  - @driftdev/sdk@1.17.0

## 1.16.13

### Patch Changes

- ec2314b: A member used inside a code comment counts as mentioned, so it is not reported as missing.
- Updated dependencies [ec2314b]
  - @driftdev/sdk@1.16.13

## 1.16.12

### Patch Changes

- 0422f62: Bump `@openpkg-ts/sdk` to ^0.54.11. `ArrayLike` and `ArrayBufferLike` are inlined instead of emitted as a `$ref` that is never registered. Spec stays ^0.54.9.
- Updated dependencies [0422f62]
  - @driftdev/sdk@1.16.12

## 1.16.11

### Patch Changes

- bedbb53: Bump `@openpkg-ts/sdk` to ^0.54.10. Schema expansion is budgeted per export, so large packages no longer degrade by export order (zod: 27% -> 100% of exports with full schemas; valibot 64% -> 100%). An interface or class records `extends` even when the base is unresolved, and its shape stays open; generic aliases written in a signature (`StateCreator<...>`) stay as written refs; type parameters are never type refs; an `export { X }` of an imported binding resolves. Spec stays ^0.54.9.
- 5568245: `prose-unknown-key`: an overload that takes an object at that position whose keys cannot be seen (unresolved, generic, open) silences the rule instead of being skipped, so a key only that overload declares is not reported (zod `toJSONSchema(registry, { uri })`). Overloads that take a primitive or a function there still do not count.
- Updated dependencies [bedbb53]
- Updated dependencies [5568245]
  - @driftdev/sdk@1.16.11

## 1.16.10

### Patch Changes

- efafea4: PageDocument claim coverage and attribution. A name an earlier fence of the page declares at its top level (`const useStore = create(...)`, function, class, destructured) shadows the export of the same name in later fences for call-site rules, bindings, the deprecated check and inventory claims, until a fence imports it from the package again; a printed signature or `declare` is not a shadow. `ns.f(...)` through a namespace alias (imported, or the page's conventional alias) is an inventory claim per (fence, export) with `text` as written (`z.string`), routed to the fence's `alsoSpecs` entry; a chained member that resolves through spec return types alone is one too (`z.string().email()` cites `ZodString.email` on the `email` token), and in a fence that names no entry only when no other entry types the same chain. A backticked `.member()` ignores owners outside the public surface (`$` / `_` names; types neither exported nor declared as an export's parameter / return type): `.parse()` on zod is `ZodType.parse`. A backticked bare builtin name is the export on its own API reference section (a code or call-form heading ancestor, or the H1 / frontmatter title, that is exactly that name) and before schema / function / action / method / hook / component / API / export / util / utility / helper. New rule `prose-literal-type-mismatch`: a string / number / boolean literal argument, object-literal property value (closed parameter shape) or JSX attribute where every applicable overload declares exactly another primitive; locator is the literal.
- Updated dependencies [efafea4]
  - @driftdev/sdk@1.16.10

## 1.16.9

### Patch Changes

- 66d76e5: PageDocument claim attribution. A destructured element is bound to the closed spec type of its own property or tuple position, never to the callee's return type (else unbound). Fence inventory claims are located inside their own fence, one per (fence, export), on the call or import token. Bare words match an export only as camelCase, multi-hump PascalCase or snake_case (a digit alone does not qualify: `base64`, `utf8`); the word `default` never names the default export, which answers to OpenPkg's `localName` instead (`useSWR` resolves to `specRef.export: 'default'` in prose, headings, table keys and fence calls with no visible import; `registry.localNames`). A backticked `.name()` is `Type.name` (heading, sole owner, or the one ancestor every owner inherits it from) or no claim, never a top-level export. A JS/TS builtin name (`number`, `string`, `Map`, ...) is the language's unless written as a call, qualified (`z.number`), a code heading, or in a fence; `ns.name` is the export `name`, never a member of `ns`. `prose-deprecated-reference` judges the resolved reference: `z.url()` is the export `url`, not the deprecated `ZodString.url`; a member counts only through a binding or a chain of spec return types, and an unbound receiver is silent. `prose-unresolved-member` has `specRef: null` and suggests only the receiver type's own members. `Promise<T>` as OpenPkg emits it (`x-ts-type: 'Promise'`) is unwrapped. New optional `alsoSpecs` on `buildPageDocument(s)` / `detectProseDrift`: secondary entries of the same package (`zod/mini`); a name only a secondary has is not a broken reference, a fence importing a secondary's specifier is checked against that spec, and a fence importing neither is not judged through names the entries type differently. A type `$ref` resolves by spec `id` first, then by an unambiguous `name` (same-named types with distinct ids are never merged; no id match and several names = open shape, no claim); `@param {Options}` matches a `#/types/react.Options` parameter.
- 3049b30: Bump `@openpkg-ts/sdk` and `@openpkg-ts/spec` to ^0.54.9. Same-named types in one package get their own ids (`react.Options`), so a parameter no longer resolves to an unrelated namesake (valtio `devtools` options); expression default exports are extracted; const classes carry construct signatures, and a class merged with an interface carries its members.
- Updated dependencies [66d76e5]
- Updated dependencies [3049b30]
  - @driftdev/sdk@1.16.9

## 1.16.8

### Patch Changes

- 34a5ea7: PageDocument precision and locators. A default import binds to the spec's `default` export (call-site rules on every overload, `candidate` claims with `specRef.export: 'default'`; silent when the spec has none, never matched by name). A rest parameter is never required and lifts the arity bound (`rest: true`, `...args`, or an untyped trailing `args` / `rest`). A zero-argument call that is a whole expression statement (`z.map();`) is a mention, not `prose-missing-required`. `import { a: b }` is reported as invalid import syntax on that specifier instead of a missing export. A bare callee the fence declares itself is not the export of the same name. Fixes: a `#` line inside a fenced code block is never a heading (one shared fence test for every line scanner); every fence claim is located inside its own fence at the exact line and column, never on the first occurrence of the text on the page.
- 3eda972: Bump `@openpkg-ts/sdk` and `@openpkg-ts/spec` to ^0.54.8. A value and an interface under one name carry the interface's members (zod: 80 of 81 schema classes now have `parse`, `optional`, `email`...), exports bound by destructuring are kept (SWR `mutate`, `unload`), an annotated const function takes its signature from the annotation, rest parameters are `rest: true` and never required, default exports carry `localName`, and a tsconfig that sets `module` alone resolves imports on TypeScript 5 as well as 6.
- Updated dependencies [34a5ea7]
- Updated dependencies [3eda972]
  - @driftdev/sdk@1.16.8

## 1.16.7

### Patch Changes

- 3d3cde7: Bump `@openpkg-ts/sdk` to ^0.54.7. A tsconfig that sets `module` without `moduleResolution` no longer breaks relative imports during extraction, so exports typed through them stop coming out as `any` (immer's bound methods such as `setAutoFreeze` now have signatures). Spec stays ^0.54.4.
- d7e792c: PageDocument: new `prose-param-mismatch` rule checks parameter tables and `## Parameters` lists against the signatures of the export their heading names (exact or silent). Fixes: `buildPageDocuments` forwards `importSpecifier`; an aliased import is checked (and bound at call sites) by its imported name, default imports are never a missing export; `prose-deprecated-reference` is silent when the enclosing section notes the deprecation or names the replacement, and is located on the import; a self-named external type no longer overflows the closed-shape walk.
- Updated dependencies [3d3cde7]
- Updated dependencies [d7e792c]
  - @driftdev/sdk@1.16.7

## 1.16.6

### Patch Changes

- c28d727: PageDocument precision: `import * as ns` is a namespace alias (never a missing export; `ns.member` is checked as the export); receivers and bare callees bind only through a visible import or construction, not a coincidental name; foreign-import and Before/Previous fences are silent.
- f46da0b: Bump `@openpkg-ts/sdk` to ^0.54.6. Utilities over type params stay written form (`Readonly<T>`), and param defaults land on `parameter.default`. Spec stays ^0.54.4.
- Updated dependencies [c28d727]
- Updated dependencies [f46da0b]
  - @driftdev/sdk@1.16.6

## 1.16.5

### Patch Changes

- 28b68e7: PageDocument precision: printed signatures are not calls; intersection/extends keys union (open if any arm is external); generic wrappers are not closed receivers; comment-only arg lists are elisions; heading-scoped `.member()` counts; `importSpecifier` scopes prose-broken-reference to the entry export path.
- Updated dependencies [28b68e7]
  - @driftdev/sdk@1.16.5

## 1.16.4

### Patch Changes

- afc39df: PageDocument call-site precision: object-literal keys match the parameter type at that position (no claim on T / Partial<T>); JSX props are top-level only and every element in the fence is checked; gap mentions include call-return bindings and heading-scoped `x.member`; ambiguous bare members resolve through heading ancestors.
- Updated dependencies [afc39df]
  - @driftdev/sdk@1.16.4

## 1.16.3

### Patch Changes

- f873674: PageDocument: prose candidates, heading/cross-fence gap mentions, fence call-site rules.

  - Emit `kind: 'prose'` candidates for sentences, list items, and table cells that name an export or `Type.member`. Bare-word match only for camelCase, PascalCase with 2+ humps, or names with digits/underscores; dictionary-plain names (`Room`, `atom`) still need backticks. No rule, so scan/CI unchanged.
  - `spec-not-in-claims`: `new Type()` bindings persist across fences; under a heading that names type T, a backticked `member` or `member(...)` counts as `T.member`.
  - New PageDocument fence rules (not scan): `prose-unknown-key`, `prose-arity-mismatch`, `prose-missing-required`. Type arguments are not arguments. Unknown receiver = no claim.

- Updated dependencies [f873674]
  - @driftdev/sdk@1.16.3

## 1.16.2

### Patch Changes

- 23a1d93: Bump `@openpkg-ts/sdk` to ^0.54.5 and `@openpkg-ts/spec` to ^0.54.4. Extracted specs now tell `undefined` from `null` (`T | undefined` is no longer `T | null`), and a generic return type such as `LiveMap<string, V>` no longer comes out as an empty schema. Re-extract to pick this up; the CLI's spec cache is keyed on the CLI version, so upgrading does that for you.
- Updated dependencies [23a1d93]
  - @driftdev/sdk@1.16.2

## 1.16.1

### Patch Changes

- f5ef56a: PageDocument accuracy: `spec-not-in-claims` only for mapped types or headings that name the type/member; private/`_` and docs-map `internal` keys are never gaps; instance calls on `new Type()` count as mentioned; gap locator is the type heading. `prose-unresolved-member` only for package-typed receivers. `headingText` is the written heading. TypeScript `meta.name` comes from the nearest package.json. Locator paths are repo-relative.
- e15654a: Default `new Drift()` no longer sets OpenPkg `followExternal: true` when node_modules exists. That mode expands every dependency (zod's type graph OOMs on this repo's SDK entry). Default now matches CLI extract / `drift page`. Bump `@openpkg-ts/sdk` to ^0.54.3 so explicit `resolveExternalTypes: true` is bounded.
- Updated dependencies [f5ef56a]
- Updated dependencies [e15654a]
  - @driftdev/sdk@1.16.1

## 1.16.0

### Minor Changes

- 6b6f3cf: Add `PageDocument`: page-level claims with source locators and spec slices for docs hosts. SDK `buildPageDocument`; CLI `drift page --json`. Scan/lint unchanged.

### Patch Changes

- Updated dependencies [6b6f3cf]
  - @driftdev/sdk@1.16.0

## 1.15.4

### Patch Changes

- 5deca3c: Bump `@openpkg-ts/sdk` to ^0.54.2: stubbed `typescript` API types carry their package origin, and a platform global's origin no longer depends on TypeScript's declaration order.
- Updated dependencies [5deca3c]
  - @driftdev/sdk@1.15.4

## 1.15.3

### Patch Changes

- a780c8b: Bump `@openpkg-ts/sdk` to ^0.54.0: external type origins resolve to the real package on pnpm and bun installs (was `.pnpm`), and the extractor no longer carries a model dependency.
- c9ac7c9: `drift docs propose --docs` (no docs file yet) now carries the stub's `sectionRe`, same as `drift docs init`. Both build entries through one `stubPage`, so pages whose tables sit under non-default headings no longer reach Jev with every key counted as a gap.
- Updated dependencies [a780c8b]
  - @driftdev/sdk@1.15.3

## 1.15.2

### Patch Changes

- e9db4a0: `drift docs init` writes `sectionRe` into the stub when the matched table sits under a heading the default `option|config` regex misses, so the stub reproduces under scan. Key coverage counts qualified `Type.key` references (namespaces, classes) as mentions, and `drift docs propose` sends that evidence to Jev. Bump `@openpkg-ts/sdk` to ^0.53.1 (no more path-named types from `export * as Ns`).
- Updated dependencies [e9db4a0]
  - @driftdev/sdk@1.15.2

## 1.15.1

### Patch Changes

- 75c4ca6: Drop leftover health score, coverage-history subpath, sandbox/GitHub URL helpers, and unused CLI progress UI. Coverage floor stays `coverage.min` / `--min`.
- 7ce04d4: Bump `@openpkg-ts/sdk` to `^0.53.0`. Spec stays `^0.52.0` (not published).
- Updated dependencies [75c4ca6]
- Updated dependencies [7ce04d4]
  - @driftdev/sdk@1.15.1

## 1.15.0

### Minor Changes

- 1393a8f: Opinionated four-path CLI. One checker. No shims.

  - `drift` is the only check (coverage + lint + prose + key coverage). `--min` is coverage. Findings fail. No health score.
  - `drift docs init|propose|baseline` replaces `docs-map`. Auto-loads `drift.docs.json`. `--map` overrides. Propose still opt-in Jev, never scan.
  - Deleted: ci, health, coverage, lint, examples, release, report, context, cache, filter, validate, commands, config, init, semver, changelog, diff, breaking.
  - Action runs `drift`. Dropped docs-pr, docs-issue, release-gate, release-changelog, validate-examples.
  - MCP: extract, list, get, scan. One skill: `/drift`.
  - Bump `@openpkg-ts/sdk` `^0.52.2` and `@openpkg-ts/spec` `^0.52.0`.

### Patch Changes

- Updated dependencies [1393a8f]
  - @driftdev/sdk@1.15.0

## 1.14.0

### Minor Changes

- 2e20375: `--run` no longer executes every `@example` block, and the install/timeout path is no longer a hang or a script runner.

  - **Go polarity:** examples without a `// =>` assertion are type-checked and skipped at run time. Execution is opt-in via the assertion itself.
  - **Install:** `--ignore-scripts` on npm/pnpm/yarn/bun, plus `trustedDependencies: []` in the harness `package.json` so Bun's default-trusted list cannot run lifecycle scripts. Local packages are staged with `scripts` stripped first — npm still runs the target's `prepare` while packing a directory, even with `--ignore-scripts`. Failed installs are not retried with scripts enabled.
  - **Timeout:** examples spawn detached; the process group is SIGKILL'd on timeout; the promise resolves on `'exit'` (with a hard deadline) so a pipe-holding grandchild cannot stall `--run`.
  - **Untrusted packages** (outside the local workspace, or `--untrusted`): macOS `sandbox-exec` denies network and credential paths; `node --permission` sits underneath as defense in depth. Other platforms refuse rather than run unsandboxed. Own-package / CI is unsandboxed so real SDK examples can still call APIs.
  - **Env allowlist** (`PATH`, `HOME`, `TMPDIR`, `LANG`) on install and example spawns.
  - **`--yes`** or `examples.run` in config is required for `--run` when not a TTY.
  - Docs: `--run` no longer claims to execute "in a sandbox." The warning now says it installs the package.

### Patch Changes

- Updated dependencies [2e20375]
  - @driftdev/sdk@1.14.0

## 1.13.0

### Minor Changes

- f3a960c: Bump `@openpkg-ts/sdk` to ^0.51.0 and `@openpkg-ts/spec` to ^0.50.0, up from ^0.43.0.

  No drift API changes, but extracted specs change: `x-ts-type` property coverage, `x-ts-declared`, `inlineTags`, `typeParameters`, JSON Schema 2020-12 output, and the declaration-keyed `resolveTypeId` collision fix all come through from the extractor.

### Patch Changes

- Updated dependencies [f3a960c]
  - @driftdev/sdk@1.13.0

## 1.12.2

### Patch Changes

- f8dcc01: `drift scan --docs-map` now runs standalone in docs-only repos: when every
  page in the map carries its own `spec` (or `entry`), no package entry point is
  required — previously scan exited 2 with "Could not detect entry point" in
  repos with no TypeScript package (the exact shape of a docs site gating SDK
  pages against committed specs). In standalone mode the output contains only
  `docsCoverage`; package `coverage`/`lint`/`health` are omitted.

  Also: `--annotations` now emits workspace-relative `file=` paths (GitHub only
  anchors annotations to the Files Changed view for relative paths), and the SDK
  key-coverage analysis accepts types-only specs (no `exports` array) without
  crashing.

- Updated dependencies [f8dcc01]
  - @driftdev/sdk@1.12.2

## 1.12.1

### Patch Changes

- 995781a: Fix version resolution in the published bundle: `meta.version` reported `0.0.0` from dist (and fed the spec-cache key, neutering version-based invalidation). Name-checked lookup now works from both src and dist layouts.

## 1.12.0

### Minor Changes

- 5dde386: Docs-page key-coverage mode: diff a spec type's option keys against what a docs page actually documents

  - **SDK** `analysis/key-coverage`: `extractDocumentedKeys` (table keys — plain/linked/dotted/`<br/>`-embedded — with heading-scoped sections) + `computeKeyCoverage` (gaps/ghosts/inversions). Ghosts resolve against ALL spec types (sub-config tables aren't false ghosts); inversion replacements auto-derive from `@deprecated Use X instead` metadata.
  - **CLI** `drift scan --docs-map <file>`: key-coverage gate — FAIL any ghost, FAIL gaps above the committed `baselineGaps` ratchet, WARN inversions. `--annotations` on scan emits GitHub Actions `::error`/`::warning`. JSON Schema ships at `@driftdev/cli/schemas/drift.docs-map.schema.json`.
  - **CLI** `drift docs-map stub` (deterministic scaffold: pages ↔ types ranked by key overlap) and `drift docs-map baseline` (ratchet tightening — never raises).
  - **Prose-drift false-positive fix**: member calls on receivers provably bound to non-package types (external-derived like `const app = express()`, untyped callback params like `res`) are no longer flagged; params annotated with a package type are still validated.
  - **Spec cache** keys now include the CLI version — an upgraded extractor never serves stale specs.
  - New skill `drift-docs-map` (agent bootstraps the map, human commits, machine runs it).

### Patch Changes

- Updated dependencies [5dde386]
  - @driftdev/sdk@1.12.0

## 1.11.0

### Minor Changes

- Upgrade extraction pipeline to @openpkg-ts/sdk ^0.43.0 (+spec ^0.43.0): per-property `description` and `@deprecated` now survive alias flattening (`Omit<Base, K> & {...}`), underscore-prefixed members are no longer dropped, and wide types are no longer silently truncated. Restores the metadata needed for deprecation/inversion detection on flattened option types.

### Patch Changes

- Updated dependencies
  - @driftdev/sdk@1.11.0

## 1.10.0

### Minor Changes

- 820cfe2: Agent-native hardening: deterministic output, exit-code taxonomy, MCP parity, config schema

  - **Reproducible output**: `SOURCE_DATE_EPOCH` (reproducible-builds convention) makes JSON byte-stable — `meta.duration` reports 0, spec/report `generatedAt` derives from the epoch. Extracted specs now carry `$schema`.
  - **Exit codes now follow the grep convention**: 0 = clean, 1 = findings/threshold missed/not found, 2 = usage or internal error. Previously all failures exited 1; scripts checking `== 1` for errors should check `>= 1` or `== 2`.
  - **MCP parity**: `drift mcp` gains `drift_lint`, `drift_coverage`, `drift_health` — the documented fix loop now works for MCP-only clients.
  - **`drift lint --annotations`**: emit GitHub Actions `::error file=…,line=…` annotations for inline PR findings.
  - **One config schema**: SDK `driftConfigSchema`/`DriftConfig` now match the CLI's real config shape (`entry`, `coverage`, `lint`, `docs.remote`); JSON Schema ships at `@driftdev/cli/schemas/drift.config.schema.json`; `drift init` stamps `$schema`; `$schema` key allowed (and ignored) in `drift.config.json`.
  - New skills `drift-fix` and `drift-enrich` (previously dangling references from `scan`/`lint` `next` hints).

### Patch Changes

- Updated dependencies [820cfe2]
  - @driftdev/sdk@1.10.0

## 1.9.0

### Minor Changes

- e11d224: Bump @openpkg-ts/sdk to ^0.40.0: extraction now flattens mapped/conditional type aliases into members (with `@deprecated` recovered from conditional arm aliases), gives function-type aliases real signatures, and defaults to strict so `T | undefined` unions survive. Combined with 1.8's instance typing, `prose-deprecated-reference` now works on wasm/proxy surfaces — e.g. `drift lint <clarinet-sdk> --docs guides/` deterministically flags `simnet.runSnippet` with "use `simnet.execute(command)` instead".

### Patch Changes

- Updated dependencies [e11d224]
  - @driftdev/sdk@1.9.0

## 1.8.0

### Patch Changes

- 7ea54de: Instance typing for prose-deprecated-reference. The registry now maps callable exports to their named return types (Promise unwrapped), so `const simnet = await initSimnet()` types `simnet` as `Simnet` — deprecated members are judged against the actual type instead of being suppressed when an identically-named non-deprecated member exists elsewhere (the proxy-over-raw-class pattern: clarinet's `runSnippet`). Deprecation notes also flow from `deprecationReason` fields, not just `@deprecated` tags.
- Updated dependencies [7ea54de]
  - @driftdev/sdk@1.8.0

## 1.7.0

### Patch Changes

- b5a9562: New prose drift type: `prose-deprecated-reference` (17 drift types total). Docs code blocks that import or call an API the spec marks deprecated are flagged — with the spec's deprecation note surfaced as the suggestion — unless the surrounding prose (±5 lines) already acknowledges the deprecation. Deterministic version of a finding class previously only agents caught (e.g. clarinet's `runSnippet` promoted while its types say `@deprecated use execute`). Registry now indexes deprecated exports/members; `MarkdownDocFile` carries raw content for prose-context checks.
- Updated dependencies [b5a9562]
  - @driftdev/sdk@1.7.0

## 1.6.0

### Minor Changes

- 0010eb0: Coverage accuracy + external docs corpus (posthog-js dogfood fixes):

  - Coverage no longer counts external re-exports as undocumented. Exports whose
    declaration lives outside the analyzed program (`source.file === '<external>'`
    or a package-only source) are excluded from the denominator in
    `buildDriftSpec`, `scan`, `coverage`, and `health`, and surfaced separately:
    `summary.externalExports` / `health.completeness.external` in the SDK,
    `coverage.external` in CLI JSON, and a "+N external (not resolvable here)"
    note in human output. New SDK exports: `isExternalExport`,
    `EXTERNAL_SOURCE_FILE`; `ApiSource` gains `package`/`version`.
  - New `--docs <patterns...>` flag on `scan` and `lint`: point prose drift at an
    arbitrary markdown corpus (glob patterns or directories, e.g. a hosted docs
    site pulled down locally) instead of the repo-local defaults. Runs for any
    language when given explicitly; warns when patterns match no files.

### Patch Changes

- Updated dependencies [0010eb0]
  - @driftdev/sdk@1.6.0

## 1.5.1

### Patch Changes

- 27474da: Readable type labels for OpenAPI surfaces. The adapter preserves inlined schema names as `title` (so a resolved `$ref` still knows it was `CandidateInfoSuccessResponse`); `drift get` renders composed types (`string | null`, `Success | Error`) instead of bare `anyOf`/`oneOf`, and long parameter names no longer collide with the type column.
- Updated dependencies [27474da]
  - @driftdev/openapi-adapter@1.0.1

## 1.5.0

### Minor Changes

- f243b9a: Agent-native drift. Multi-lang truth primitives: `extract`, `list`, `get`, `coverage`, `lint`, and `health` now accept any surface — `--spec <path-or-URL>` (OpenAPI 3.x), `--abi` + `.clar` (Clarity) — with language inferred from flags/extension. `drift get candidateInfo --spec https://…/openapi.json` returns the authoritative operation. New `drift mcp`: stdio MCP server exposing `drift_extract/list/get/scan/diff/breaking` to any agent. Skills shipped in-repo (`skills/drift`, `skills/docs-verify`).

## 1.4.0

### Minor Changes

- 215bede: OpenAPI adapter: map OpenAPI 3.0/3.1 documents to ApiSpec and scan REST API surfaces with `drift scan --lang openapi --spec <file>`. Operations become exports (operationId or `METHOD path`), requestBody object schemas flatten into named parameters, local $refs resolve (cycle-safe), success responses carry through — including RPC-style oneOf [success, error] shapes. Named component schemas map to ApiSpec types.
- 327ed34: Publish integrity + audit fixes. CLI: replace `workspace:*` internal dep ranges with real semver (1.3.0 was uninstallable via npm — the workspace protocol leaked into the published manifest), drop dead main/types/exports fields (bin-only package), correct `--help` claims. SDK: ship `schemas/` so `SCHEMA_URL` stops 404ing, remove orphaned scan/install modules, move type-only @vercel/sandbox out of runtime deps. All packages: `engines.node >=20`, `prepublishOnly` build guard; clarity adapter now ships LICENSE + README.

### Patch Changes

- Updated dependencies [215bede]
- Updated dependencies [327ed34]
  - @driftdev/openapi-adapter@1.0.0
  - @driftdev/sdk@1.4.0
  - @driftdev/clarity-adapter@1.0.1

## 1.3.0

### Minor Changes

- Add `--lang clarity` and `--abi` flags to `drift scan` for Clarity smart contract support

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @driftdev/clarity-adapter@1.0.0
  - @driftdev/sdk@1.3.0

## 1.0.0

### Minor Changes

- CLI: add formatWarning(), surface silent catches, next hints in human output, actionable entry detection errors, agent help epilog, workflow descriptions

  SDK: remove convenience re-exports from barrel (use subpath imports: @driftdev/sdk/analysis, /history, /cache, /markdown, /examples, /types)

### Patch Changes

- Updated dependencies
  - @driftdev/sdk@1.0.0

## 0.42.0

### Minor Changes

- 2bf7604: Remove fix module and `fixable` field from all types. Add `Drift.scan()` facade. Add subpath exports (`/markdown`, `/examples`, `/history`, `/cache`). Bare `drift` always runs scan. Add `drift commands`.

### Patch Changes

- Updated dependencies [2bf7604]
  - @driftdev/sdk@0.42.0

## 0.41.0

### Patch Changes

- Consolidate @driftdev/spec into @driftdev/sdk. Spec types, constants, and JSON schema validation are now exported directly from the SDK. The @driftdev/spec package is removed.
- Updated dependencies
  - @driftdev/sdk@0.41.0

## 0.40.0

### Minor Changes

- Two-surface CLI: hide non-human commands from --help, default bare `drift` to scan, replace --capabilities with --tools, enrich context with per-issue detail and undocumented export locations

## 0.39.0

### Minor Changes

- Improve release readiness and docs-quality workflows:

  - Expand CLI entry detection to support richer `package.json` layouts (`exports`, `module`, `bin`) and CLI-style source resolution.
  - Make `drift ci` skip packages with no detectable entry point instead of failing the entire run.
  - Align package metadata and docs links with the canonical repository.
  - Clarify SDK/docs guidance for API-surface regeneration and async return semantics.

### Patch Changes

- Updated dependencies
  - @driftdev/sdk@0.39.0

## 0.38.0

### Minor Changes

- Add monorepo support to `drift breaking` and `drift diff` commands with `--all` and `--private` flags

## 0.37.0

### Minor Changes

- Add diff, breaking changes, and undocumented export analysis to `drift ci`. Structured PR comments with collapsible sections. Remove agent server in favor of GitHub Action docs-sync.

## 0.36.0

### Minor Changes

- Add --project flag to drift init, delete dead TS config system, rewrite action.yml as drift ci wrapper, remove --ci from docs

### Patch Changes

- Updated dependencies
  - @driftdev/sdk@0.36.0
  - @driftdev/spec@0.36.0

## 0.35.1

### Patch Changes

- Retry publish under @driftdev scope (0.35.0 version was consumed by failed publish).
- Updated dependencies
  - @driftdev/sdk@0.35.1
  - @driftdev/spec@0.35.1

## 0.35.0

### Minor Changes

- Publish under @driftdev scope. Rename legacy config files from doccov.config._ to drift.config._, update CI/Action/docs references.

### Patch Changes

- Updated dependencies
  - @driftdev/sdk@0.35.0
  - @driftdev/spec@0.35.0

## 0.34.3

### Patch Changes

- feat(cli): auto-scan packages in report command when no history exists

## 0.34.2

### Patch Changes

- d0f36b6: Fix stale cache after JSDoc edits: include max source file mtime in cache key so editing any .ts file in the package busts the cache

## 0.34.1

### Patch Changes

- e4d5a97: Include skipped private package names in `--all` batch JSON output and human-readable tables

## 0.34.0

### Minor Changes

- Skip private packages by default in --all mode. Add --private flag to opt-in.

## 0.33.1

### Patch Changes

- Fix entry auto-detection for `dist/src/` layouts. Was resolving to bundled `.js` (stripped JSDoc → 0% coverage) instead of source `.ts`.

## 0.33.0

### Minor Changes

- Remove old `doccov` binary and legacy commands (check, spec, trends). Only the `drift` binary remains with all 18 commands. `bunx @doccov/cli` now defaults to `drift`.

## 0.32.0

### Minor Changes

- 0b9d171: Drift CLI with 18 commands (extract, list, get, validate, filter, coverage, lint, health, diff, breaking, semver, changelog, ci, release, report, init, cache status, cache clear), global config at ~/.drift/, spec cache with mtime invalidation

### Patch Changes

- Updated dependencies [0b9d171]
  - @doccov/sdk@0.32.0

## 0.31.1

### Patch Changes

- bump @openpkg-ts/extract 0.25.0 -> 0.27.0
- Updated dependencies
  - @doccov/sdk@0.31.1

## 0.31.0

### Minor Changes

- add batch analysis mode with glob patterns, cross-module link validation, incremental analysis, and improved drift detection

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.31.0
  - @doccov/spec@0.31.0

## 0.30.7

### Patch Changes

- perf: optimize drift detection - pre-compute fuzzy match candidates, combine example AST parsing, add early exits, skip expensive diagnostics
- Updated dependencies
  - @doccov/sdk@0.30.7

## 0.30.6

### Patch Changes

- fix: update @openpkg-ts/extract to 0.23.2 (adds deprecated flag extraction)
- Updated dependencies
  - @doccov/sdk@0.30.6

## 0.30.5

### Patch Changes

- chore(cli): bump @doccov/sdk to 0.30.4 for isExternal fix

## 0.30.3

### Patch Changes

- bump @openpkg-ts/extract ^0.19.0 -> ^0.23.0, @openpkg-ts/spec -> ^0.23.0
- Updated dependencies
  - @doccov/sdk@0.30.3

## 0.30.2

### Patch Changes

- feat(cli): add stale refs to markdown report, split coverage sections

  - Pass staleRefs to output/stats pipeline
  - Add stale references section to markdown report
  - Split exports into "Undocumented" (0%) and "Partial Coverage" (1-99%) sections
  - Add reportUrl linking for "X more" overflow links
  - Include staleRefs in JSON report output

## 0.30.1

### Patch Changes

- refactor(sdk): use SpecTag.param for param parsing, bump openpkg-ts deps

  - utils.ts: rewrite extractParamFromTag to use SpecTag.param field directly
  - param-drift.ts: pass full SpecTag to extractParamFromTag
  - index.ts: remove normalizeParamName export (unused)
  - cli/writer.ts: use findProjectRoot for cleaner relative paths
  - bump @openpkg-ts/extract ^0.18.0 -> ^0.19.0 (root, sdk)
  - bump @openpkg-ts/spec ^0.12.0 -> ^0.19.0 (sdk, cli, web)

- Updated dependencies
  - @doccov/sdk@0.30.1

## 0.30.0

### Patch Changes

- feat(sdk): add project root detection for monorepo .doccov dir placement

  - Add `findProjectRoot()` and `getDoccovDir()` utils to SDK
  - Walk up from cwd to find .git, pnpm-workspace, or workspaces field
  - Ensures .doccov/ is always at repo root, not inside subpackages
  - CLI uses SDK's getDoccovDir for cache, history, spec, and reports

- Updated dependencies
  - @doccov/sdk@0.30.0

## 0.29.4

### Patch Changes

- fix(cli): suppress noisy external type diagnostics from check output

  - Add `code` field to `Diagnostic`, `SpecDiagnostic`, and `CachedDiagnostic` interfaces
  - Preserve diagnostic codes from @openpkg-ts/extract through SDK pipeline
  - Filter out `EXTERNAL_TYPE_*` info diagnostics in CLI check command
  - Bump cache version to 1.3.0

- Updated dependencies
  - @doccov/sdk@0.29.4

## 0.29.3

### Patch Changes

- chore: sync with sdk 0.29.2

## 0.29.1

### Patch Changes

- update docs + action to use .doccov/{pkg}/ output structure, add logo to badges

## 0.29.0

### Minor Changes

- feat(badge): use doccov.json report instead of openpkg.json

  Badge endpoints now read health score from `.doccov/doccov.json` instead of computing from `openpkg.json`. Added remote docs fetching to CLI (URL, GitHub patterns) with caching support. Moved spec cache to `.doccov/cache/` subdirectory.

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.29.0

## 0.28.2

### Patch Changes

- fix(cli): fail check on runtime errors; fix(sdk): compute drift ratio from total exports
- Updated dependencies
  - @doccov/sdk@0.28.2

## 0.28.1

### Patch Changes

- 24f04ff: style: sort imports alphabetically, remove unused import
- Updated dependencies [24f04ff]
  - @doccov/sdk@0.28.1

## 0.28.0

### Minor Changes

- refactor: major cleanup - move platform packages, simplify CLI

  ## Package Restructure

  - Moved `api-shared`, `auth`, `db`, `sandbox`, `ui` from `packages/` to `apps/platform/`
  - These are now internal platform code, not publishable packages

  ## CLI Removals

  - Removed `info` command
  - Removed deprecated flags: `--min-coverage`, `--max-drift`, `--min-api-surface`, `--update-snapshot`
  - Removed output formats: `html`, `github`, `pr-comment`, `changelog`
  - Removed report renderers: changelog-renderer, github, html, pr-comment

  ## SDK Changes

  - Removed `RetentionTier` type and `pruneByTier` function (simplified to single 90-day retention)
  - Removed deprecated `minCoverage`, `maxDrift`, `minApiSurface` from `CheckConfig` type
  - Moved config schema from CLI to SDK (`docCovConfigSchema`, `normalizeConfig`)
  - Exported `DocCovConfigInput` type for config validation

  ## Type System

  - Renamed `NormalizedDocCovConfig` to `DocCovConfig`
  - Config validation schema still accepts deprecated fields for backwards compat

  ## Breaking Changes

  - Consumers using removed CLI commands/flags need to migrate
  - Consumers using tier-based retention need to use simple `pruneHistory()`

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.28.0

## 0.27.1

### Patch Changes

- fix: use resolved targetDir for cwd in check command instead of raw options.cwd

## 0.27.0

### Patch Changes

- Add unified documentation health score combining completeness + accuracy metrics
- Updated dependencies
  - @doccov/spec@0.27.0
  - @doccov/sdk@0.27.0

## 0.26.0

### Minor Changes

- Add API surface completeness analysis for forgotten exports detection

### Patch Changes

- Updated dependencies
  - @doccov/spec@0.26.0
  - @doccov/sdk@0.26.0

## 0.25.11

### Patch Changes

- chore: bump @doccov/sdk dependency
- Updated dependencies
  - @doccov/sdk@0.25.11

## 0.25.9

### Patch Changes

- refactor: extract shared CLI utilities to cli-utils package

  - Move progress, spinner, and output formatting utilities to new cli-utils package
  - Update CLI commands to use shared cli-utils (colors, symbols, summary component)
  - Update extract CLI to use shared cli-utils
  - Remove deprecated progress.ts from CLI
  - Remove outdated doc-generator examples
  - Update package READMEs

- Updated dependencies
  - @doccov/sdk@0.25.9

## 0.25.8

### Patch Changes

- fix(extract): correct package.json exports path (dist/index.js -> dist/src/index.js)
- Updated dependencies
  - @doccov/sdk@0.25.8

## 0.25.7

### Patch Changes

- Bump sdk dependency
- Updated dependencies
  - @doccov/sdk@0.25.7

## 0.25.6

### Patch Changes

- Bump SDK dependency with consolidated type extraction.

## 0.25.3

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @openpkg-ts/spec@0.12.0
  - @doccov/sdk@0.25.3

## 0.25.0

### Patch Changes

- Remove unused enrichment/diff code from SDK, delete unused UI components (drift-command-center, fix-workflow, pr-coverage)
- Updated dependencies
  - @doccov/sdk@0.25.0

## 0.24.1

### Patch Changes

- Initial release of @openpkg-ts/doc-generator

  - Core API: createDocs(), loadSpec() for loading OpenPkg specs
  - Query utilities: formatSchema(), buildSignatureString(), member filtering and sorting
  - Renderers: Markdown/MDX, HTML, JSON output formats
  - Navigation: Fumadocs, Docusaurus, and generic nav generation
  - Search: Pagefind and Algolia compatible indexes
  - React components: Headless (unstyled) and styled (Tailwind v4) variants
  - CLI: generate, build, dev commands
  - Adapter architecture: Extensible framework integration pattern

- Updated dependencies
  - @doccov/sdk@0.24.1
  - @openpkg-ts/spec@0.11.1
  - @doccov/spec@0.24.1

## 0.24.0

### Patch Changes

- Consolidate drift types in SDK, simplify spec package, add source extraction to spec command
- Updated dependencies
  - @doccov/sdk@0.24.0
  - @doccov/spec@0.24.0

## 0.23.0

### Patch Changes

- refactor: modularize api into shared packages with centralized middleware
- Updated dependencies
  - @doccov/sdk@0.23.0

## 0.22.0

### Minor Changes

- Remove deprecated `tsType` field in favor of `schema`, add CLI warning when `--runtime` requested without built code

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.22.0
  - @openpkg-ts/spec@0.11.0

## 0.21.0

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.21.0

## 0.20.0

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.20.0

## 0.19.0

### Minor Changes

- feat: hybrid schema extraction for Zod, Valibot, TypeBox, ArkType

  - Static extraction via TypeScript Compiler API (default, no runtime)
  - Runtime extraction via Standard Schema spec (opt-in, richer output)
  - New `--runtime` CLI flag enables hybrid mode
  - Falls back gracefully from runtime to static extraction

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.19.0

## 0.18.0

### Minor Changes

- Enhanced quality rules, filtering, github context, analysis reports, new API routes (ai, billing, demo, github-app, invites, orgs), trends command, diff capabilities

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.18.0
  - @openpkg-ts/spec@0.10.0

## 0.17.0

### Minor Changes

- feat: add YAML config support (doccov.yml)

  - Added `--format yaml` option to `doccov init` command
  - Config loader now supports `doccov.yml` and `doccov.yaml` files
  - YAML configs are simpler - no imports or TypeScript needed

## 0.16.0

### Minor Changes

- feat(cli): add --format pr-comment for actionable GitHub PR comments

  - New pr-comment format with coverage summary, undocumented exports grouped by file, drift issues, contextual fix guidance
  - Added --repo-url and --sha options for clickable file links
  - Added strict mode presets: ci, release, quality
  - Moved PR comment rendering from action.yml inline JS to CLI

## 0.15.1

### Patch Changes

- Consolidate duplicate FIXABLE_DRIFT_TYPES into single isFixableDrift() source
- Updated dependencies
  - @doccov/sdk@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.15.0

## 0.14.0

### Minor Changes

- Add step-based progress feedback for CLI commands

  - Added `StepProgress` utility for multi-step progress tracking with timing
  - Added `ProgressBar` utility for incremental progress with percentage/ETA display
  - Updated `spec` command to show 5-step progress (resolve, config, generate, validate, write)
  - Updated `check` command to show 5-6 step progress (includes optional example validation step)
  - Removed `ora` dependency in favor of simpler carriage-return based progress that doesn't freeze during I/O blocking operations

## 0.13.0

### Patch Changes

- e063639: refactor: replace scan architecture with plan/execute model

  **@doccov/sdk**

  - Add `fetchGitHubContext()` for fetching repository metadata via GitHub API
  - Add `BuildPlan` types for describing build/analysis execution plans
  - Export new scan types: `BuildPlan`, `BuildPlanStep`, `BuildPlanExecutionResult`, `GitHubProjectContext`
  - Remove legacy scan orchestrator in favor of external execution

  **@doccov/cli**

  - Remove `scan` command (moved to API service)
  - Update `spec` command with improved analysis

  **@openpkg-ts/spec**

  - Add `BuildPlan` and related types to schema
  - Extend spec schema for plan-based analysis

- Updated dependencies [e063639]
  - @doccov/sdk@0.13.0
  - @openpkg-ts/spec@0.9.0

## 0.12.0

### Minor Changes

- ### `diff` command improvements

  **New features:**

  - Hash-based report caching - repeated diffs with same specs are instant
  - `--no-cache` flag to bypass cache and force regeneration
  - `--strict` presets (`ci`, `release`, `quality`) for streamlined CI configuration
  - Support for both positional and explicit `--base`/`--head` arguments
  - `--min-coverage` and `--max-drift` threshold flags (same as `check` command)
  - Config file support for thresholds via `doccov.config.ts`
  - Simplified terminal output with detailed reports written to `.doccov/`

  **SDK additions:**

  - `calculateAggregateCoverage(spec)` - lightweight coverage calculation from exports
  - `ensureSpecCoverage(spec)` - ensures spec has top-level coverage score
  - `getDiffReportPath()` - hash-based diff report path generation

  **Fixes:**

  - Coverage now correctly calculated for raw specs (was showing 0% → 0%)
  - Shared validation utilities extracted to avoid duplication between `check` and `diff`

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.12.0

## 0.11.0

### Minor Changes

- Version sync release

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.11.0

## 0.10.2

### Patch Changes

- Update @doccov/sdk dependency to include monorepo entry point path fix

## 0.10.0

### Minor Changes

- ### @openpkg-ts/spec

  **Breaking (pre-1.0):** Restructured spec types to move coverage metadata to an enrichment layer:

  - Removed `docs` field from `SpecExport` and `OpenPkg` types (now provided via SDK enrichment)
  - Changed `SpecDocsMetadata.missing` from `SpecDocSignal[]` to `string[]` (now uses rule IDs)
  - Added `DriftType` as a standalone exported type
  - Added `DriftCategory` type with three categories: `structural`, `semantic`, `example`
  - Added `DRIFT_CATEGORIES` mapping, `DRIFT_CATEGORY_LABELS`, and `DRIFT_CATEGORY_DESCRIPTIONS` constants for categorizing and displaying drift issues

  ### @doccov/sdk

  **Breaking (pre-1.0):** Replaced the lint module with a new quality rules engine and added spec-level caching:

  - Removed the `lint` module (`LintConfig`, `LintRule`, `lintExport`, `lintExports`, etc.)
  - Added `quality` module with a flexible rules-based engine:
    - `QualityRule`, `QualityViolation`, `QualityConfig` types
    - `evaluateQuality()`, `evaluateExportQuality()` functions
    - Built-in rules: `CORE_RULES`, `STYLE_RULES`, `BUILTIN_RULES`
  - Added `cache` module for spec-level caching:
    - `loadSpecCache()`, `saveSpecCache()`, `validateSpecCache()`
    - `hashFile()`, `hashFiles()`, `hashString()` utilities
  - Added enrichment layer:
    - `enrichSpec()` function
    - `EnrichedExport`, `EnrichedOpenPkg`, `EnrichedDocsMetadata` types
  - Added unified report generation:
    - `generateReport()`, `generateReportFromEnriched()`
    - `DocCovReport`, `CoverageSummary`, `DriftReport` types
  - Added unified example validation:
    - `validateExamples()` function
    - `parseExamplesFlag()`, `shouldValidate()` utilities
    - `ExampleValidationResult`, `ExampleValidationOptions` types

  ### @doccov/cli

  **Breaking (pre-1.0):** Revamped commands for better UX and added multi-format reporting:

  - Renamed `generate` command to `spec` (generates OpenPkg spec files)
  - Added `info` command for quick package summary (exports, coverage, drift at a glance)
  - Revamped `check` command:
    - Removed options: `--require-examples`, `--exec`, `--no-lint`, `--no-typecheck`, `--ignore-drift`
    - Added options: `--examples [mode]` (presence, typecheck, run), `--max-drift <percentage>`, `--format <format>`, `-o/--output <file>`, `--stdout`, `--no-cache`
    - Now supports multi-format output: text, json, markdown, html, github
    - Writes reports to `.doccov/` directory by default
  - Added spec-level caching (use `--no-cache` to bypass)
  - Simplified config schema to match new quality rules engine

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.8.0
  - @doccov/sdk@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @doccov/sdk@0.9.0
  - @openpkg-ts/spec@0.7.0

## 0.8.0

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @doccov/sdk@0.8.0
  - @openpkg-ts/spec@0.6.0

## 0.7.0

### Minor Changes

- consolidate cli by removing lint, report, and typecheck commands (now in SDK). simplify check, generate, and scan commands to use unified SDK modules.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @openpkg-ts/spec@0.5.0
  - @doccov/sdk@0.7.0

## 0.6.0

### Patch Changes

- update command implementations and config
- Updated dependencies
- Updated dependencies
  - @doccov/sdk@0.6.0
  - @openpkg-ts/spec@0.4.1

## 0.5.8

### Patch Changes

- feat: add lint and typechecking commands
- Updated dependencies
  - @doccov/sdk@0.5.8

## 0.5.7

### Patch Changes

- show holistic documentation coverage percentage in diff output
- Updated dependencies
- Updated dependencies
  - @openpkg-ts/spec@0.4.0
  - @doccov/sdk@0.5.7

## 0.5.6

### Patch Changes

- enhance diff command output with member-level changes section and method-level targeting in docs impact
- Updated dependencies
  - @doccov/sdk@0.5.6

## 0.5.4

### Patch Changes

- bug(cli): do not check for doccov config in `diff` when no `--docs` flag is supplied

## 0.5.3

### Patch Changes

- chore(cli): cleanup progress feedback

## 0.5.2

### Patch Changes

- Fix spinner animation freezing during long-running operations by configuring ora with proper stdin handling and cursor management. Also update SDK dependency to ^0.3.7 to include latest fixes.

## 0.5.1

### Patch Changes

- chore: cleanup ux feedback and add err check for scanning private repos

## 0.5.0

### Minor Changes

- feat(cli): add markdown docs impact detection to diff command
  refactor(cli): consolidate fix functionality into check command
  refactor(sdk): reuse detection extraction
  fix(api): bug in api scan
  fix(api): monorepo detection in scan
  fix(api): improve scan-stream reliability and ref support

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.3.3

## 0.4.7

### Patch Changes

- Fix findPackageInMonorepo to check root package.json first, enabling analysis of repos where the main package is at the root (like zod)

## 0.4.6

### Patch Changes

- Fix monorepo package detection for pnpm workspaces by parsing pnpm-workspace.yaml

## 0.4.5

### Patch Changes

- Use improved entry point detection in generate command. When using `--cwd`, the CLI now correctly resolves `.d.ts` paths to source files and supports more project structures.

## 0.4.4

### Patch Changes

- Fix entry point detection to prefer .ts source files over .d.ts declarations. Scanning repos with `types` field pointing to `.d.ts` now correctly resolves to source files like `src/index.ts`.

## 0.4.0

### Minor Changes

- ## OpenPkg Spec Builder Improvements

  ### New Features

  - **Class inheritance**: Capture `extends` and `implements` clauses
  - **Namespace exports**: Support `export namespace X { ... }`
  - **Function overloads**: Capture all overload signatures
  - **Mapped/conditional types**: Preserve `tsType` for complex types
  - **External types**: Graceful handling with `kind: "external"` stubs
  - **Interface methods**: Serialize method signatures on interfaces
  - **Index signatures**: Capture `[key: string]: T` patterns
  - **Default values**: Preserve parameter defaults
  - **Rest parameters**: Mark with `rest: true`
  - **Getter/setter pairs**: Merge into single member
  - **Call/construct signatures**: Capture callable interfaces
  - **Type predicates**: Preserve `x is string` and `asserts x` returns
  - **Union discriminants**: Add `discriminator: { propertyName }` for tagged unions
  - **Re-export aliasing**: Correctly track `export { X as Y }`

  ### CLI Changes

  - Renamed `--no-external-types` to `--skip-resolve` across all commands
  - Added `--skip-resolve` to `report` and `scan` commands
  - New warnings for unresolved external types
  - Info message when `node_modules` not found

  ### Bug Fixes

  - Fixed circular type reference detection
  - Fixed destructured parameter TSDoc matching
  - Fixed drift detection for destructured params

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.3.0
  - @openpkg-ts/spec@0.3.0

## 0.3.0

### Minor Changes

- Add --ignore-drift flag to check command to allow drift detection without failing the check

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages
- Updated dependencies [c74cf99]
  - @openpkg-ts/spec@0.2.2
  - @doccov/sdk@0.2.2

## 0.2.1

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages
- Updated dependencies [c74cf99]
  - @openpkg-ts/spec@0.2.1
  - @doccov/sdk@0.2.1
