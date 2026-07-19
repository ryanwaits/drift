---
"@driftdev/sdk": minor
"@driftdev/cli": minor
---

Docs-page key-coverage mode: diff a spec type's option keys against what a docs page actually documents

- **SDK** `analysis/key-coverage`: `extractDocumentedKeys` (table keys — plain/linked/dotted/`<br/>`-embedded — with heading-scoped sections) + `computeKeyCoverage` (gaps/ghosts/inversions). Ghosts resolve against ALL spec types (sub-config tables aren't false ghosts); inversion replacements auto-derive from `@deprecated Use X instead` metadata.
- **CLI** `drift scan --docs-map <file>`: key-coverage gate — FAIL any ghost, FAIL gaps above the committed `baselineGaps` ratchet, WARN inversions. `--annotations` on scan emits GitHub Actions `::error`/`::warning`. JSON Schema ships at `@driftdev/cli/schemas/drift.docs-map.schema.json`.
- **CLI** `drift docs-map stub` (deterministic scaffold: pages ↔ types ranked by key overlap) and `drift docs-map baseline` (ratchet tightening — never raises).
- **Prose-drift false-positive fix**: member calls on receivers provably bound to non-package types (external-derived like `const app = express()`, untyped callback params like `res`) are no longer flagged; params annotated with a package type are still validated.
- **Spec cache** keys now include the CLI version — an upgraded extractor never serves stale specs.
- New skill `drift-docs-map` (agent bootstraps the map, human commits, machine runs it).
