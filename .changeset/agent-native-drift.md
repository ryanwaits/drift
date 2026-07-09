---
"@driftdev/cli": minor
---

Agent-native drift. Multi-lang truth primitives: `extract`, `list`, `get`, `coverage`, `lint`, and `health` now accept any surface — `--spec <path-or-URL>` (OpenAPI 3.x), `--abi` + `.clar` (Clarity) — with language inferred from flags/extension. `drift get candidateInfo --spec https://…/openapi.json` returns the authoritative operation. New `drift mcp`: stdio MCP server exposing `drift_extract/list/get/scan/diff/breaking` to any agent. Skills shipped in-repo (`skills/drift`, `skills/docs-verify`).
