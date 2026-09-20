# drift

> Your code changed. Your docs didn't.

Detect when your docs drift from your code. TypeScript packages, REST APIs (OpenAPI), Clarity contracts — Drift extracts what your API actually is and finds every doc that's now wrong.

## Hour one

```bash
bun add -D @driftdev/cli
drift
drift list --undocumented
```

No config. Entry auto-detects from `package.json`. JSON when piped.

## CI this sprint

```yaml
- uses: ryanwaits/drift/action@v1
  with:
    min-coverage: 80
```

Same check as local `drift`. Floor cannot drop. No model.

## Docs site (option tables)

```bash
drift docs init contents/docs
drift docs propose              # optional
# commit drift.docs.json
drift
drift docs baseline
```

Ghosts fail. Gaps above baseline fail. Inversions warn.

## Agents

```bash
drift mcp                       # drift_extract, drift_list, drift_get, drift_page, drift_scan
drift get createClient --json   # one export. one claim per get.
drift --tools
```

Detection in the tool. Mutation in the agent. CI stays dumb and fast.

## Other truth sources

```bash
drift --spec openapi.json
drift token.clar --abi token.abi.json
```

## Who it helps

- Teams shipping TypeScript libraries, SDKs, or CLI packages with public exports.
- API teams whose hand-written guides must stay true to their OpenAPI spec.
- Maintainers who want CI to catch documentation regressions before merge.
- DX/DevRel teams that need docs accuracy to scale with release velocity.

## Who it does not help

- Apps with no API surface (no exports, no spec, no contract).
- Teams whose docs are not part of their release workflow.

## Commands

| Command | Job |
|---------|-----|
| `drift` | The check: coverage + lint + prose + key coverage |
| `drift list --undocumented` | Backlog |
| `drift get <name>` | One export, full signature |
| `drift page <md> --json` | PageDocument for hosts (locators + spec slices) |
| `drift docs init \| propose \| baseline` | Page→type file lifecycle |
| `drift mcp` | Agent tools |

`--docs` sets the prose corpus. `drift.docs.json` auto-loads. `--map` overrides. `--min` is the coverage floor. Findings always fail.

Exit 0 clean, 1 findings, 2 error. `{ok, data, meta}` on stdout when piped.

## How it works

```
TypeScript / OpenAPI / Clarity
            │
            │  openpkg or adapter
            ▼
         ApiSpec          ← ground truth
            │
            │  drift
            ▼
    structured findings   ← file:line, exit codes
```

Optional: `drift docs propose` (Jev) writes judgment into `drift.docs.json`. You commit it. CI re-derives the diff. No model in the gate.

## Guides

- New: `docs/getting-started.md`
- CI: `docs/ci-integration.md`
- Config: `docs/configuration.md`
- SDK: `docs/sdk.md`
- Map: `docs/guide-map.md`

## License

MIT licensed. Free and open source.
