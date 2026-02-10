# Usage Guide

## Quick Start

1. Install the CLI:
```bash
bun add -g @driftdev/cli
```

2. Run a full scan:
```bash
drift scan
```

3. Check documentation coverage:
```bash
drift coverage --min 80
```

## CLI Commands

### `drift scan`

Run coverage + lint + prose drift + health in one pass.

```bash
drift scan [entry] [options]
```

Options:
- `--min <n>` — Minimum health threshold (exit 1 if below)
- `--all` — Run across all workspace packages
- `--private` — Include private packages

```bash
drift scan
drift scan --min 80
drift scan --all --private
```

### `drift coverage`

Documentation coverage score.

```bash
drift coverage [entry] [options]
```

Options:
- `--min <n>` — Minimum coverage % (exit 1 if below)
- `--all` — Run across all workspace packages

```bash
drift coverage --min 80
drift coverage --all
```

### `drift lint`

Cross-reference JSDoc vs code signatures. Detects 15 drift types including prose drift (broken import references in markdown).

```bash
drift lint [entry] [options]
```

Options:
- `--all` — Run across all workspace packages
- `--private` — Include private packages

```bash
drift lint
drift lint --json         # includes filePath/line for agent-driven fixes
drift lint --all
```

### `drift health`

Documentation health score (default command — bare `drift` runs this).

```bash
drift health [entry] [options]
```

Options:
- `--min <n>` — Minimum health threshold
- `--all` — Run across all workspace packages

### `drift examples`

Validate @example blocks.

```bash
drift examples [entry] [options]
```

Options:
- `--typecheck` — Type-check examples
- `--run` — Execute examples in sandbox
- `--min <n>` — Minimum example coverage %
- `--all` — Run across all workspace packages

```bash
drift examples
drift examples --typecheck --run
drift examples --min 50
```

### `drift extract`

Extract full API spec as JSON.

```bash
drift extract [entry] [options]
```

Options:
- `-o <file>` — Write to file
- `--only <patterns>` — Include exports matching glob
- `--ignore <patterns>` — Exclude exports matching glob
- `--all` — Extract all workspace packages

### `drift ci`

CI checks with GitHub integration.

```bash
drift ci [options]
```

Options:
- `--all` — Check all packages, not just changed
- `--private` — Include private packages

Features:
- Auto-detects changed packages via `git diff`
- Posts PR comments with results
- Writes GitHub step summaries
- Appends to history
- Generates `.drift/context.md`

### `drift init`

Create configuration file.

```bash
drift init
```

### Agent Discovery

```bash
drift --capabilities    # JSON list of all commands + flags
```

## Configuration

### drift.config.json

```json
{
  "entry": "src/index.ts",
  "coverage": {
    "min": 80,
    "ratchet": true
  },
  "lint": true,
  "docs": {
    "include": ["README.md", "docs/**/*.md"],
    "exclude": ["node_modules/**"]
  }
}
```

## Understanding the Output

All commands return `{ok, data, meta}` JSON when piped or with `--json`:

```json
{
  "ok": true,
  "data": {
    "coverage": { "score": 88, "documented": 243, "total": 275, "undocumented": 32 },
    "lint": { "issues": [...], "count": 36 },
    "health": 89,
    "pass": true
  },
  "meta": { "command": "scan", "duration": 7845, "version": "0.34.3" }
}
```

### Drift Issues

Each lint issue includes enough context for agents to fix:

```json
{
  "export": "createUser",
  "issue": "JSDoc documents parameter 'userId' which is not present in the signature.",
  "location": "userId",
  "filePath": "docs/api.md",
  "line": 42
}
```

`filePath` and `line` appear on prose drift issues (markdown references to non-existent exports).

## SDK Usage

### Basic Analysis

```typescript
import { DocCov } from '@driftdev/sdk';

const doccov = new DocCov();
const result = await doccov.analyzeFileWithDiagnostics('src/index.ts');

console.log(`Package: ${result.spec.meta.name}`);
console.log(`Exports: ${result.spec.exports.length}`);
```

### Drift Detection

```typescript
import { computeDrift, buildExportRegistry, detectProseDrift, discoverMarkdownFiles } from '@driftdev/sdk';

// JSDoc drift
const drift = computeDrift(spec);
for (const [name, issues] of drift.exports) {
  for (const d of issues) {
    console.log(`${name}: ${d.issue}`);
  }
}

// Prose drift (broken markdown references)
const registry = buildExportRegistry(spec);
const mdFiles = discoverMarkdownFiles(process.cwd());
const proseIssues = detectProseDrift({ packageName: '@my/pkg', markdownFiles: mdFiles, registry });
```

### Spec Validation

```typescript
import { normalize, validateSpec, diffSpec } from '@openpkg-ts/spec';

const normalized = normalize(spec);
const result = validateSpec(normalized);

const diff = diffSpec(oldSpec, newSpec);
console.log('Breaking changes:', diff.breaking);
```

## CI Integration

### GitHub Actions

```yaml
name: Docs Coverage
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bunx @driftdev/cli scan --min 80
```

### Simple CI

```bash
# Fail if health below 80% or any lint issues
drift scan --min 80
```
