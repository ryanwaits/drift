# Design: docs-page key-coverage mode

Status: draft (Phase 2 of the docs-coverage kickoff). Origin: PostHog Prototype B — drift 1.9.0 prose
mode found 1 finding (a false positive) and 0 of 90 real gaps on the posthog.com corpus; the real
gap-finder was a 120-line custom script. This design makes that script a drift capability.

## Trust boundary (the one principle)

**LLM writes the map, machine runs the map.**

1. **Deterministic layer — the gate.** Spec extraction (openpkg ≥0.43 carries per-property
   `description`/`deprecated` through alias flattening — verified on `PostHogOptions`), documented-key
   extraction from markdown, the set-diff (gaps/ghosts/inversions), gate policy + exit codes. Everything
   CI acts on is re-derivable from committed artifacts. Zero LLM in this path.
2. **Agent layer — proposes, never enforces.** Bootstraps the docs map, classifies ambiguous keys,
   ranks gaps, drafts fixes. Output = committed config/annotations the deterministic layer consumes.
   Implemented as skills + a deterministic scaffold command, never an LLM call inside the CLI.

## Decisions

### D1. Command surface: extend `drift scan`

`drift scan --docs-map <file>` activates key-coverage mode (one-command philosophy; scan is already
the composed CI gate with `--min` + exit codes). No new top-level analysis command. `--annotations`
(from lint) is added to scan for gate parity. A small `drift docs-map <stub|baseline>` utility command
family handles map lifecycle (see D5) — utilities, not analysis.

### D2. The committed artifact: `drift.docs-map.json` (central file, v1)

```jsonc
{
  "$schema": "https://unpkg.com/@driftdev/cli/schemas/drift.docs-map.schema.json",
  "version": 1,
  "pages": [
    {
      "page": "contents/docs/libraries/node/index.mdx",     // required
      "extraPages": ["contents/docs/libraries/node/_snippets/*.mdx"],
      "type": "PostHogOptions",                              // required — spec type to diff against
      "spec": "specs/node.json",                             // committed spec file…
      "entry": "packages/node/src/index.ts",                 // …or live extraction (exactly one required)
      "sectionRe": "^Configuration options$",                // default /option|config/i, level-aware exit
      "internal": ["token"],                                 // agent-proposed, human-committed
      "annotations": {                                       // agent-proposed, human-committed
        "tracing_headers": "prose-documented",
        "segment": "internal-by-convention"
      },
      "deprecated": ["..."],                                 // OVERRIDE ONLY — auto-derived from spec
      "replacements": { "personalApiKey": "secretKey" },     // OVERRIDE ONLY — auto-derived (see D3)
      "baselineGaps": 37
    }
  ]
}
```

- Central map first; per-page frontmatter is a documented **v2 alternative** (map is easier to
  bootstrap and doesn't require write access to the docs repo).
- `deprecated`/`replacements` auto-derive from spec metadata now that openpkg 0.43 preserves it;
  the map fields exist only as overrides for non-TS specs or missing `@deprecated` prose.
- JSON Schema shipped in the cli package next to `drift.config.schema.json`; `$schema` stamped by stub.
- Annotation vocabulary (closed set, v1): `prose-documented` (key is genuinely documented in prose,
  not a table — excluded from gap FAIL, still reported), `internal-by-convention` (treated as
  internal), `ignore` (excluded entirely, requires human-committed reason in a `#comment`).
  Default behavior WITHOUT annotation: a prose-mentioned key is still a gap (js baseline stays 41).

### D3. Deterministic engine: new SDK module `analysis/docs-coverage/`

Prose-drift is existence-only (audited); key coverage is the inverse traversal — new module, built on
existing scaffolding:

- **`extract-keys.ts`** — documented-key extraction. Extends the `markdown/parser.ts` remark walk with
  `table` + `inlineCode` + `heading` visitors (today only fenced `code` is visited). Rules ported from
  the reference impl, all hit on the real corpus:
  - table rows: first-cell backtick key — plain `` `key` ``, linked ``[`key`](…)``, dotted
    `fetch_options.cache` → prefix, `<br/>`-embedded cells
  - section scoping via `sectionRe` with heading-level-aware exit
  - per-key source location (file, line) for annotations
  - `mentioned` set: backtick-mention or code-block key anywhere in the corpus (feeds reporting +
    the agent's `prose-documented` classification; never a gate input by itself)
- **`diff-keys.ts`** — the set-diff. Forward `type → Set<propertyKey>` map built for **all** spec
  types (trivial addition next to `compute.ts` `indexMembers`, which stores the inverse):
  - **ghost** = documented key absent from EVERY spec type (sub-config tables like `AutocaptureConfig`
    legitimately document other types' keys — naive per-type check = 20 false ghosts, correct = 0)
  - **gap** = type key not documented, classified internal (`_`-prefix ∪ map `internal` ∪
    `internal-by-convention`) / deprecated / user-facing
  - **inversion** = documented deprecated key whose replacement is NOT documented. Replacement
    resolution: parse `` Use `X` instead `` from the spec's deprecation reason, else map override.
- Phantom-key guard: openpkg still fails to strip `Omit<Base, K>` keys (`before_send` on
  `PostHogOptions`) — upstream bug to file; until fixed, workaround is map `internal`/`ignore`.

### D4. Gate policy (CLI, ported from the smoke-tested sketch)

- **FAIL** any ghost (docs claim an option that doesn't exist)
- **FAIL** user-facing gaps > `baselineGaps` (ratchet — drift shrinks, never grows)
- **WARN** inversions; **WARN** at-baseline gaps
- Config errors (type not in spec, bad map) = exit **2**; findings = exit **1**; clean = **0**
- `--annotations` → `::error file=<page>::…` / `::warning file=<page>::…`
- `drift docs-map baseline` rewrites `baselineGaps` **downward only** to current counts (ratchet
  tightening is mechanical; loosening requires a human editing the committed map)

### D5. LLM integrations (each optional, each writes committed artifacts)

1. **`drift docs-map stub`** (deterministic, no LLM): scans `--docs` corpus for pages whose tables
   contain ≥N backtick keys, lists candidate object types from the spec, emits a skeleton map with
   `"type": null` markers. The scaffold an agent (or human) fills in.
2. **Skill `drift-docs-map`**: agent runs stub → reads pages + `drift list`/`drift get` → fills
   page→type mapping, proposes `internal`/`annotations`, runs `drift scan --docs-map` once, sets
   `baselineGaps` from the verified first run → human reviews and commits.
3. **Gap annotation / ranking / fix drafts**: agent tags gaps in the map (`prose-documented`, …) and
   drafts doc snippets from spec descriptions (possible now that 0.43 preserves them). Extends
   `drift-docs-map` + `drift-enrich` skills; deterministic runs simply respect the committed tags.

### D6. Prose-mode false-positive fix (independent, ships whenever)

Invert the burden in `detectUnresolvedMembers`: only flag member calls whose **receiver is traceable
to the package** (package import, package-derived via `extractPackageDerivedNames`, or member of a
known exported type). Covers both reproduced cases: `const app = express()` (external-derived) and
`res` in a callback (untyped parameter). Existing skip clauses become subsumed by the allow-list rule.

## Implementation order (Phase 3)

1. ~~Extraction metadata P0~~ — done (openpkg 0.43, drift 1.11.0)
2. SDK `analysis/docs-coverage/` (extract-keys + diff-keys + types) with fixture tests
3. Docs-map loader + JSON Schema + `scan --docs-map` wiring + gate policy/exit codes + `--annotations`
4. `drift docs-map stub|baseline`
5. Prose false-positive fix (D6)
6. Skill `drift-docs-map`
7. Phase 4 re-run vs posthog.com corpus — acceptance: js 41/0/0, node 37/0/1
   (`personalApiKey`→`secretKey`), rn 12/0/0 (gaps/ghosts/inversions), Express FP gone

Fixtures: trimmed posthog.com pages + stored specs committed under test fixtures — they encode every
parser edge case found in the wild (linked/dotted/`<br/>` keys, section exit, sub-type keys,
prose-documented `tracing_headers`, RN exact-heading `sectionRe`).

## Out of scope v1 (documented limitations)

- Per-page frontmatter mapping (v2; central map wins conflicts when both exist)
- Multi-repo corpora (posthog.com flag pages importing from PostHog/posthog main)
- Non-table documented forms as gate inputs (definition lists, prose) — annotation-only
- Non-TS languages beyond what `--spec`/`--abi` already provide (the diff engine is ApiSpec-generic;
  corpus association is the only TS-biased piece)
