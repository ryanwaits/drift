---
name: drift
description: Documentation drift detection for any API surface — TypeScript packages, OpenAPI/REST specs, Clarity contracts. Use when checking doc coverage, validating docs against an API, detecting drift, or fixing outdated documentation. Triggers on "doc coverage", "validate docs", "drift", "docs out of sync", "are my docs accurate", "update docs to match API", "set up docs coverage", "map docs pages to types".
---

# Drift

The `drift` CLI is the truth oracle. It extracts what an API *actually is*. You verify claims against it — never from memory, never by grepping source.

```bash
drift --tools        # machine-readable manifest
```

All commands support `--json` → `{ok, data, meta}` on stdout. Exit 0 clean, 1 findings, 2 usage/internal error.

## Truth sources

```bash
drift [entry]                            # TypeScript (entry auto-detected)
drift --spec openapi.json                # OpenAPI 3.x (path or URL)
drift token.clar --abi token.abi.json    # Clarity
```

## Commands

```bash
drift                         # the check: coverage + lint + prose + key coverage
drift list [--undocumented]   # exports/operations
drift get <name>              # ONE export in full. one get per claim.
drift page <md> --json        # PageDocument: locators + spec slices. hosts paint this.
drift docs init [dir]         # scaffold drift.docs.json (never networks)
drift docs propose            # optional Jev. TYPESAFE_API_KEY. never CI
drift docs baseline           # ratchet baselineGaps. never raises
drift mcp                     # extract/list/get/scan tools
```

`drift.docs.json` auto-loads when present. `--map` overrides. `--docs` sets the prose corpus.

Prefer MCP when available: `drift mcp` → `drift_extract`, `drift_list`, `drift_get`, `drift_page`, `drift_scan`.

## Workflows

### Hour one
1. `drift --json`
2. `drift list --undocumented --json`
3. Report coverage + issues + undocumented backlog.

### Fix issues
1. `drift --json` → issues with `filePath` + `line`
2. For each: `drift get <name> --json` → edit docs/JSDoc to match. Preserve prose voice.
3. Re-run `drift` until pass.

### Validate a docs site (claim-by-claim)
1. `drift list --json` → existence oracle
2. Enumerate pages. Extract claims (named exports, params, types, deprecation, examples).
3. One `drift get <name>` per claim. Classify: phantom, missing-param, wrong-param, stale-deprecation, example-drift, undocumented.
4. Report with `file:line`. Read-only unless asked to fix.

### Docs-site option tables
1. `drift docs init <corpus>` → writes `drift.docs.json`
2. Optional: `drift docs propose` (TYPESAFE_API_KEY)
3. Review page→type and annotations. Human commits. Never auto-commit.
4. `drift` → ghosts fail, gaps above baseline fail, inversions warn
5. `drift docs baseline` once verified

### Generate stubs
1. `drift list --undocumented --json`
2. For each: `drift get <name> --json` → signature-accurate stub with `<!-- TODO -->` / `TODO:`
3. Never invent descriptions.

### Pay down undocumented (maintainers)
1. `drift list --undocumented --json`
2. For each: `drift get <name> --json`
3. If it is the product: add a real JSDoc description. Never invent. Never `TODO` to game coverage.
4. If leftover: **unexport** from the public barrel. Do not document dead API.
5. Re-run `drift --min <new score>`. Only raise the floor. Never lower `--min` to pass CI.

## Rules

- Spec is source of truth. Grep only searches doc content.
- One `drift get` per claim. Never from memory.
- Preserve doc prose; only fix code references, signatures, factual claims.
- Propose never runs in CI. The committed file is the gate.
- Don't inflate `baselineGaps` to mute CI.
- Don't lower `--min` to mute CI. Unexport leftovers or document keepers.
