# CLI Reference

Binary: `drift`. Package: `@driftdev/cli`.

Human text in a TTY, JSON envelope when piped. `--json` / `--human` override.

## Global flags

| Flag | Description |
|------|-------------|
| `--json` | Force JSON |
| `--human` | Force human text |
| `--config <path>` | Config file |
| `--cwd <dir>` | Run as if started in `<dir>` |
| `--no-cache` | Bypass spec cache |
| `--tools` | Print command manifest and exit |

Envelope: `{ok, data, meta: {command, duration, version}, next?}`. Exit 0 clean, 1 findings, 2 error.

Truth flags on scan/list/get/extract: `--lang`, `--spec`, `--abi`. Inferred from `--spec` / `--abi` / `.clar`.

## `drift` / `drift scan [entry]`

The check. Bare `drift` runs this. Auto-loads `drift.docs.json`.

| Flag | Description |
|------|-------------|
| `--min <n>` | Coverage floor (exit 1 if below) |
| `--all` | All workspace packages |
| `--private` | Include private packages with `--all` |
| `--docs <patterns...>` | Prose corpus (overrides config) |
| `--map <file>` | Docs file override |
| `--annotations` | GitHub `::error`/`::warning` |

Fails if: lint/prose issues, coverage `< min`, ghosts, or user-facing gaps `> baselineGaps`.

```json
{
  "coverage": { "score": 88, "documented": 22, "total": 25, "undocumented": 3 },
  "lint": { "issues": [], "count": 0 },
  "pass": true,
  "docsCoverage": { "pass": true, "pages": [] }
}
```

## `drift list [search]`

`--undocumented`, `--drifted`, `--kind`, `--full`.

## `drift get <name>`

One export/operation. Fuzzy suggestions if missing.

## `drift docs`

Lifecycle for `drift.docs.json` (schema: `@driftdev/cli/schemas/drift.docs.schema.json`).

```bash
drift docs init [dir]       # scaffold. never networks. writes drift.docs.json
drift docs propose          # optional Jev. TYPESAFE_API_KEY. never scan
drift docs baseline [file]  # ratchet baselineGaps. never raises
```

`--map` / default file: `drift.docs.json`. Propose writes judgment; you commit; `drift` is a set-diff.

Key coverage: **ghost** fail, **gap** above baseline fail, **inversion** warn.

## `drift mcp`

stdio MCP: `drift_extract`, `drift_list`, `drift_get`, `drift_scan`.

## `drift extract`

Hidden. Full spec JSON. `--tools` / MCP.
