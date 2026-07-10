# TRIAGE — risky items deferred from the 2026-07-09 audit

Confirmed real by adversarial verification; not landed because each needs a
deliberate migration or judgment call. Safe fixes from the same audit already
shipped (see CHANGELOG).

## lucide-react 0.563.0 → 1.x (apps/site)
Crossed its 1.0 major (2026-03-23). Runtime dep of the site; icon API renames
possible.
- Repro: `npm view lucide-react version` vs apps/site/package.json pin.
- Proposed: read the 1.0 migration notes, bump pin, `bun run build:site`,
  visually spot-check pages using icons.

## commander ^14 → 15 (packages/cli)
Runtime dep major. CLI arg parsing is the whole product surface; 15 changes
option handling edge cases.
- Proposed: read release notes, bump, full CLI test suite + manual `--help`,
  bare-`drift`, `--tools` smoke.

## tsconfig consolidation — DONE 2026-07-09
tsconfig.base.json shared; packages extend it. isolatedDeclarations only where
d.ts ships (sdk, adapters), not the bin-only cli. `bun run typecheck` runs
tsc per package + site; wired into CI. Fixing the 39 root-tsc errors surfaced
4 real bugs: cli imported the nonexistent `OpenPkgSpec` from @openpkg-ts/spec,
zod v4 `ZodArray` generic arity, `drift get` passed SpecType[] where the
renderer needed a name-keyed record (referenced types silently never rendered),
version fallback typing.

## CI lint gate
No lint step in drift.yml. Lint is now green locally (audit cleared 62
diagnostics), but adding the gate should land as its own change so a red gate
is attributable.
- Proposed: add `bunx biome check packages/ apps/` step after tests.

## bunup pin 0.16.26 (0.16.32 available)
Pin is deliberate (unpinned "latest" hid the zod-bundling breakage for
months). Bump only with the repro green:
fresh tmp dir + token.clar/token.abi.json →
`bun run packages/cli/src/drift.ts scan --lang clarity --abi token.abi.json --json token.clar`.

## report.ts $schema points at parked domain
packages/sdk/src/analysis/report.ts:~124 emits
`https://drift.dev/schemas/v1.0.0/report.schema.json` — drift.dev is a parked
lander. SCHEMA_URL (unpkg) is fixed this release; the report one needs either
hosting the schema or repointing to the unpkg path shipped in `schemas/`.

## openpkg extraction gaps (found dogfooding on @stacks/clarinet-sdk wasm surface, 2026-07-09)
Upstream (@openpkg-ts/sdk) — wasm-bindgen d.ts extracts cleanly (44-member class,
full signatures), but: (1) mapped conditional types (`{[K in keyof SDK]: ...}`)
don't flatten to members; (2) function-type aliases (`type CallFn = (...) => X`)
render as opaque `x-ts-type`; (3) `string | undefined` return lost its
`undefined` arm (getContractSource). Repro: `npm i @stacks/clarinet-sdk` →
`drift get node_modules/@stacks/clarinet-sdk/dist/esm/node/src/sdkProxy.d.ts Simnet`.

## posthog-js dogfood: coverage % inflated by external symbols — DONE 2026-07-10
`drift scan` on posthog-js@1.399.1 counted `<external>` re-exports (docs live
in @posthog/core, never cross the extraction boundary) as undocumented.
Fixed: `isExternalExport` in packages/sdk/src/analysis/health.ts detects both
extraction forms (`source.file === '<external>'`, and package-only source
with no file; file+package = resolved, counts normally). Bucketed out of the
denominator in buildDriftSpec + scan/coverage/health CLI (single + batch);
surfaced as `summary.externalExports` / `health.completeness.external` /
`coverage.external` and "+N external (not resolvable here)" in human output.
- Same run, working as designed (don't re-file): `--json` piped output ends
  cleanly at `}` (timing line is TTY-only); posthog's pnpm
  `min-release-age=7` install friction is their .npmrc, not drift.

## posthog-js dogfood: hosted docs corpus mode — Phase A DONE 2026-07-10
Phase A shipped: `--docs <patterns...>` on scan + lint (globs or directories;
dir expands to **/*.{md,mdx}; overrides config.docs; warns on zero matches;
runs for any lang when explicit). resolveDocsCorpus in
packages/cli/src/utils/docs-corpus.ts.
Phase B still open — what made the posthog audit manual: hosted docs call
`posthog.capture(...)` with no import, so import-based registry linking never
fires. Needs: instance-linking heuristic (config `instanceNames` or infer
singleton from spec), bidirectional claims report (claims-not-in-spec /
spec-not-in-claims), maybe URL ingestion. Overlaps with the prose-drift
registry/linking design below — solve together.

## Prose drift for non-TS langs
`scan` gates prose drift behind `lang === 'typescript'`
(packages/cli/src/commands/scan.ts). For OpenAPI (docs-site guides vs spec)
prose drift is the interesting check — needs a registry/linking heuristic that
doesn't assume npm package imports. Design before enabling.

## Old-brand npm deprecations — DONE 2026-07-09
@doccov/{cli,sdk,ui,api,fumadocs-adapter}, @driftdev/spec, and the
uninstallable @driftdev/cli@1.3.0 all carry deprecation notices now.
Note: @driftdev/spec has no source repo anymore (consolidated into
@driftdev/sdk in 4c8e3f0), so its stale "DocCov specification schema"
description can't ship a fix — deprecation is the burial.
