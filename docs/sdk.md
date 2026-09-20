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
});

for (const issue of issues) {
  console.log(`${issue.filePath}:${issue.line} -- ${issue.issue}`);
  if (issue.suggestion) console.log(`  ${issue.suggestion}`);
}
```

### `buildPageDocument` -- Host JSON

Page-level claims for a docs host (Vercel, Mintlify, Fumadocs, or a separate review product). Coordinates are source markdown (`line` + `col` + heading slug), plus a spec slice. Not a review UI. Jev is not in this package. `candidate` claims are inventory; only `rule` hits are the existing detectors. Scan/CI do not consume this document.

`spec-not-in-claims` is a rule only when the page is on the hook for that type: a `drift.docs.json` row, or a heading that names the type or a member. Mentioning a type in a fence or backtick is a candidate, never a gap dump. Private/`_` members and map `internal` keys are never gaps. Instance calls on `new Type()` count as mentioned, including when the binding is in an earlier fence on the page. A binding from a call whose spec return type is a spec type (`const room = client.joinRoom()`) counts like `new Room()`. Under a heading that names type T, a backticked `member` or `member(...)`, and fence `x.member` / `x.member(`, count as `T.member`. The gap locator is the heading that names the type. `locator.headingText` is the written heading, not the slug. `locator.path` is repo-relative. Bare member names that exist on more than one type resolve through heading ancestors; no specRef if none of those headings names a candidate type.

`kind: 'prose'` candidates are sentence / list-item / table-cell spans that name an export or `Type.member`. No rule — scan/CI ignore them. Bare-word match only for camelCase, PascalCase with 2+ humps, or names with digits/underscores; dictionary-plain names (`Room`, `atom`) still need backticks.

Fence call-site rules (PageDocument only, not scan): `prose-unknown-key` (JSX prop / object-literal key not on the closed object type of the parameter at that position; no claim for `T` / `Partial<T>` / `Record` / index signatures; intersection keys are the union of every arm, interface keys include `extends`, and any external/unresolved/generic arm opens the shape), `prose-arity-mismatch` (more positional args than any overload; a printed signature is not a call), `prose-missing-required` (required in every overload; JSX `children` counts; an argument list that is only a comment or `...` is an elision). JSX props are the component's top-level props, not nested property types. Every JSX element in the fence that resolves to an export is checked. Type arguments are not arguments (`foo<A, B>()` is zero args). Unknown receiver = no claim. `prose-unresolved-member` only for class/interface receivers with a closed member list (mapped `Snapshot<T>` / conditional `ExtractState<S>` are the reader's). Under a heading that names T, a backticked `.member()` counts as `T.member`.

`prose-broken-reference` checks imports whose specifier equals `packageName`. When the spec is a `package.json` `exports` subpath, pass `importSpecifier` (`jotai/utils`) so imports from the package root and other subpaths are silent.

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
