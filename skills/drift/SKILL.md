---
name: drift
description: Documentation drift detection and sync for any API surface — TypeScript packages, OpenAPI/REST specs, Clarity contracts. Use when checking doc coverage, validating docs against an API, detecting drift, or fixing outdated documentation. Triggers on "doc coverage", "validate docs", "drift", "docs out of sync", "are my docs accurate", "update docs to match API".
---

# Drift: Documentation Sync

Detect and fix documentation drift. The `drift` CLI is the truth oracle: it deterministically extracts what an API *actually is*. You verify claims against it — never from memory, never by grepping source.

## Core Concept

**Truth-first.** Get the API surface from `drift`, not by reading source files. `drift` resolves re-exports, barrel files, request schemas, and gives the authoritative list.

```bash
drift --tools        # machine-readable manifest of every command
```

All commands support `--json` → `{ok, data, meta}` envelope on stdout.

## Truth Sources

Every primitive accepts any supported surface:

```bash
drift <cmd> [entry]                          # TypeScript (entry auto-detected from package.json)
drift <cmd> --spec openapi.json              # OpenAPI 3.x (path or https URL; lang inferred)
drift <cmd> token.clar --abi token.abi.json  # Clarity contract (lang inferred from .clar)
```

## Commands

```bash
drift list [search]            # exports/operations: name, kind, description, deprecated
drift get <name>               # ONE export in full: params, required, types, returns
drift extract                  # full spec as JSON
drift scan [--min N]           # coverage + lint + health in one pass
drift coverage [--min N]       # % documented
drift lint                     # doc/code mismatches with filePath + line
drift diff --base <ref>        # what changed vs a git ref (TS only)
drift breaking --base <ref>    # breaking changes only (TS only)
drift scan --docs-map <file>   # key-coverage gate: docs pages vs spec type keys
drift docs-map stub|baseline   # scaffold / ratchet the page→type map
```

Prefer MCP when available: `drift mcp` exposes these as `drift_*` tools.

## Workflows

### Coverage
1. `drift coverage --json` (add truth flags for non-TS)
2. `drift list --undocumented --json` for the backlog
3. Report: documented/total + undocumented list.

### Validate docs against the API
1. `drift list --json` → the real surface
2. Read the docs (user-provided path/URL)
3. For each doc claim: `drift get <name> --json` → compare params, optionality, types, deprecation
4. Report inaccuracies with `file:line`. (For a full docs sweep, use the `docs-verify` skill.)

### Check drift vs a baseline
1. `drift diff --base <ref> --json` (or `drift breaking --base <ref> --json`)
2. For each change, grep docs for impacted references
3. Report locations needing updates.

### Fix drift
1. `drift lint --json` → issues with `filePath` and `line`
2. For each issue: `drift get <name> --json` → correct signature; edit the doc/JSDoc to match
3. Only modify code references and signatures — preserve prose voice
4. Re-run `drift lint` to confirm zero.

### Docs-site key coverage
1. `drift docs-map stub --docs <corpus> --out drift.docs-map.json --json` → scaffold
2. Review/refine the map (page→type, sectionRe, annotations) — see the `drift-docs-map` skill
3. `drift scan --docs-map drift.docs-map.json --json` → gaps/ghosts/inversions per page
4. `drift docs-map baseline` once verified; commit the map. CI fails on ghosts or gap growth.

### Generate stubs
1. `drift list --undocumented --json`
2. For each: `drift get <name> --json` → signature-accurate stub with `<!-- TODO -->` prose markers
3. Never invent descriptions — TODO markers are for the human.

## Output Formats

JSON report, GitHub issue, or PR comment on request. Keep the shape:

```json
{
  "type": "coverage|validation|drift",
  "package": "<name>",
  "summary": { "total": 0, "documented": 0, "issues": 0 },
  "issues": [
    { "export": "<name>", "severity": "breaking|warning|info",
      "type": "missing|outdated|inaccurate", "message": "...",
      "locations": ["docs/file.md:45"] }
  ]
}
```

## Rules

- The spec is the source of truth; grep is only for searching doc content.
- One `drift get` per claim you verify — never trust memory of an API.
- Preserve doc prose; only fix code references, signatures, and factual claims.
- Exit codes matter in CI (grep convention): 0 = clean, 1 = findings/threshold missed/not found, 2 = usage or internal error.
