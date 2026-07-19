---
name: drift-docs-map
description: Bootstrap and maintain a drift docs map — the committed page→type artifact for docs key-coverage mode (drift scan --docs-map). Use when setting up key-coverage for a docs site, mapping docs pages to spec types, classifying ambiguous option keys, or when asked to "set up docs coverage", "map docs pages to types", "bootstrap the docs map". The agent proposes; the human commits; CI runs the map deterministically.
---

# Drift Docs Map: LLM Writes the Map, Machine Runs the Map

Produce or refine `drift.docs-map.json` so `drift scan --docs-map` can deterministically gate
docs↔code drift (gaps/ghosts/inversions). Your judgment lands ONLY in the committed map — never in
the runtime path.

## Bootstrap workflow

1. `drift docs-map stub --docs <corpus> --out drift.docs-map.json --json` — deterministic scaffold:
   pages with option tables, types ranked by key overlap.
2. Review each proposed mapping: open the page, run `drift get <Type> --json`, confirm the page
   actually documents that type's options. Fix wrong `type` picks (overlap ranking is mechanical).
3. Tighten extraction where needed: set `sectionRe` when the options table lives under a
   non-default heading (default matches /option|config/i); add `extraPages` globs for snippet
   includes (`_snippets/*.mdx`).
4. Pin the spec source per page: `spec` (committed spec file — preferred for CI) or `entry`;
   omit both only when the map runs inside the package repo.
5. Run `drift scan --docs-map drift.docs-map.json --json` and triage:
   - **ghosts** — real doc bugs (option doesn't exist) or extraction misses. Verify each with
     `drift get`; fix docs or the map, never suppress silently.
   - **gaps with `mentioned: true`** — read the page; if genuinely documented in prose (a dedicated
     section, not a passing mention), annotate `"<key>": "prose-documented"`.
   - **conventional/internal keys** (`token`, `name`, platform internals) — annotate
     `"<key>": "internal-by-convention"` or add to `internal`.
   - **known-irrelevant keys** — `"<key>": "ignore"`, with a `"#<key>-reason"` comment key nearby.
6. `drift docs-map baseline drift.docs-map.json` — sets each page's `baselineGaps` from the
   verified run (ratchet: it only tightens).
7. Hand the map to the human for review + commit. Never commit it yourself unless asked.

## Rules

- One `drift get` per mapping/classification decision — never from memory.
- Deprecated/replacement metadata auto-derives from the spec; only add `deprecated`/`replacements`
  overrides when the spec lacks `@deprecated` metadata (non-TS surfaces, missing JSDoc).
- Don't inflate `baselineGaps` to make CI pass — the baseline is a debt ledger, not a mute button.
  Raising it is a human decision made in review.
- Gap fix drafts: use each gap's `description` (from the spec) as the doc snippet seed — see the
  `drift-enrich` skill.
- Exit codes: 0 clean, 1 findings, 2 bad map/config — a 2 means fix the map you wrote.
