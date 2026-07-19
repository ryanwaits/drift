---
"@driftdev/sdk": minor
"@driftdev/cli": minor
---

Agent-native hardening: deterministic output, exit-code taxonomy, MCP parity, config schema

- **Reproducible output**: `SOURCE_DATE_EPOCH` (reproducible-builds convention) makes JSON byte-stable — `meta.duration` reports 0, spec/report `generatedAt` derives from the epoch. Extracted specs now carry `$schema`.
- **Exit codes now follow the grep convention**: 0 = clean, 1 = findings/threshold missed/not found, 2 = usage or internal error. Previously all failures exited 1; scripts checking `== 1` for errors should check `>= 1` or `== 2`.
- **MCP parity**: `drift mcp` gains `drift_lint`, `drift_coverage`, `drift_health` — the documented fix loop now works for MCP-only clients.
- **`drift lint --annotations`**: emit GitHub Actions `::error file=…,line=…` annotations for inline PR findings.
- **One config schema**: SDK `driftConfigSchema`/`DriftConfig` now match the CLI's real config shape (`entry`, `coverage`, `lint`, `docs.remote`); JSON Schema ships at `@driftdev/cli/schemas/drift.config.schema.json`; `drift init` stamps `$schema`; `$schema` key allowed (and ignored) in `drift.config.json`.
- New skills `drift-fix` and `drift-enrich` (previously dangling references from `scan`/`lint` `next` hints).
