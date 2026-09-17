# Getting Started

Drift extracts the real API surface and checks that JSDoc, examples, and markdown still describe it.

## Install

```bash
bun add -D @driftdev/cli
```

## Hour one

```bash
drift
drift list --undocumented
```

No config. Entry auto-detects from `package.json` (`types`, `exports`, `main`, `module`, `bin`). Pass an entry if the layout is custom: `drift src/index.ts`.

JSON when piped: `{ok, data, meta}`. Exit 0 clean, 1 findings, 2 error.

## CI this sprint

```yaml
- uses: ryanwaits/drift/action@v1
  with:
    min-coverage: 80
```

Same check as local `drift`. Floor cannot drop. No model.

Or: `drift --min 80` in any CI.

## Docs site (option tables)

```bash
drift docs init contents/docs
drift docs propose              # optional, needs TYPESAFE_API_KEY
# review + commit drift.docs.json
drift                           # key coverage now on
drift docs baseline
```

Ghosts fail. Gaps above baseline fail. Inversions warn.

## Agents

```bash
drift mcp
drift get createClient --json
```

One get per claim. Never from memory.

## Other truth sources

```bash
drift --spec openapi.json
drift token.clar --abi token.abi.json
```
