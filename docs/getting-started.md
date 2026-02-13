# Getting Started

Drift analyzes your TypeScript exports and checks that JSDoc, markdown docs, and `@example` blocks are accurate and complete.

## Who This Is For

- Maintainers of TypeScript packages with public APIs.
- Teams that want PR-time docs quality gates, not manual release checks.
- Engineers who need fast, file-level guidance for fixing stale docs.

## Why Teams Use Drift

- Prevent docs regressions before merge.
- Keep examples and markdown aligned with shipped exports.
- Turn docs quality into an objective CI signal.

## How To Use This Guide

1. Install Drift.
2. Run an initial scan and inspect what failed.
3. Add a CI threshold once your baseline is known.

## Install

```bash
bun add -D @driftdev/cli
```

Or globally:

```bash
bun add -g @driftdev/cli
```

This gives you the `drift` binary.

## First Run

Navigate to a TypeScript package with an exported API surface (library, SDK, or CLI package) and run:

```bash
drift scan
```

Drift auto-detects your entry point from `package.json` `"types"`, `"typings"`, `"exports"`, `"main"`, `"module"`, and `"bin"` fields. No configuration needed for standard package layouts.

If your package has a custom layout, pass an explicit entry:

```bash
drift scan src/drift.ts
```

Recommended first pass:

```bash
drift scan
drift lint
drift list --undocumented
```

Example output:

```
  my-lib v1.2.0

  Coverage   72%  (18/25 exports documented)
  Lint        3 issues
  Health     68%

  Issues:
    parseConfig    @param 'options' type mismatch: documented as 'object', actual 'ParseOptions'
    createClient   @returns type mismatch: documented as 'Client', actual 'Promise<Client>'
    formatOutput   @param 'input' not in signature (has: 'data')

  Health below threshold? Use drift scan --min 80 to enforce.
```

JSON output (piped or `--json`):

```json
{
  "ok": true,
  "data": {
    "coverage": { "score": 72, "documented": 18, "total": 25, "undocumented": 7 },
    "lint": { "issues": [...], "count": 3 },
    "health": 68,
    "pass": true,
    "packageName": "my-lib",
    "packageVersion": "1.2.0"
  },
  "meta": { "command": "scan", "duration": 342, "version": "0.38.0" }
}
```

## What to Do Next

Based on your scan results:

- **Low coverage** -- Add JSDoc descriptions to undocumented exports. Run `drift list --undocumented` to see which ones.
- **Lint issues** -- Your JSDoc is out of sync with code. Run `drift lint` for details with file paths and line numbers.
- **Low health** -- Health is a 50/50 blend of coverage and accuracy. Fix lint issues first (they tank accuracy), then fill in missing docs.

## Useful Follow-Up Commands

```bash
# List all exports, filter to undocumented
drift list --undocumented

# List exports with stale JSDoc
drift list --drifted

# Check just coverage
drift coverage

# Check just lint (JSDoc accuracy)
drift lint

# Validate @example blocks
drift examples

# Set a coverage floor
drift config set coverage.min 80

# Run in CI with PR comments
drift ci
```

## Monorepo Support

All analysis commands support `--all` to run across workspace packages:

```bash
drift scan --all
drift coverage --all
drift lint --all
```

Private packages are excluded by default. Add `--private` to include them.

## Zero Footprint

Drift stores all state in `~/.drift/` -- nothing is written to your project directory. Config can optionally live in `drift.config.json` or `package.json` `"drift"` key. See [Configuration](./configuration.md).

## Further Reading

- [Guide Map](./guide-map.md) -- pick the right doc by role and goal
- [CLI Reference](./cli-reference.md) -- every command and flag
- [Drift Detection](./drift-detection.md) -- what drift is and how detection works
- [Coverage and Health](./coverage-and-health.md) -- scoring details
- [CI Integration](./ci-integration.md) -- GitHub Actions setup
- [Configuration](./configuration.md) -- config file locations and all keys
- [SDK](./sdk.md) -- using `@driftdev/sdk` programmatically
- [Pricing & Packaging](./pricing-packaging.md) -- OSS + BUSL + hosted plan proposal
