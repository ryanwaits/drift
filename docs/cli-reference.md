# CLI Reference

Binary: `drift`. Package: `@driftdev/cli`.

All commands output human-readable text in a TTY, JSON envelopes when piped. Override with `--json` or `--human`.

## Global Flags

| Flag | Type | Description |
|------|------|-------------|
| `--json` | boolean | Force JSON output (default when piped) |
| `--human` | boolean | Force human-readable output (default in TTY) |
| `--config <path>` | string | Path to drift config file |
| `--cwd <dir>` | string | Run as if started in `<dir>` |
| `--no-cache` | boolean | Bypass spec cache |
| `--capabilities` | boolean | Print machine-readable command/flag manifest and exit |

## JSON Output Envelope

Every command wraps its output in this shape:

```json
{
  "ok": true,
  "data": { ... },
  "meta": {
    "command": "scan",
    "duration": 342,
    "version": "0.35.0"
  },
  "next": {
    "suggested": "drift-fix skill",
    "reason": "2 of 3 issues are auto-fixable"
  }
}
```

Error shape:

```json
{
  "ok": false,
  "error": "Entry file not found",
  "meta": { "command": "scan", "duration": 12, "version": "0.35.0" }
}
```

---

## Composed Commands

### `drift scan [entry]`

Coverage + lint + prose drift + health in one pass.

| Flag | Type | Description |
|------|------|-------------|
| `--min <n>` | number | Minimum health threshold (exit 1 if below) |
| `--ci` | boolean | Strict mode: exit 1 on any issue |
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |

```bash
drift scan
drift scan src/index.ts --min 80
drift scan --all --private
```

Data shape:

```json
{
  "coverage": { "score": 88, "documented": 22, "total": 25, "undocumented": 3 },
  "lint": {
    "issues": [
      { "export": "parseConfig", "issue": "@param 'options' type mismatch", "filePath": "src/config.ts", "line": 42 }
    ],
    "count": 1
  },
  "health": 85,
  "pass": true,
  "packageName": "my-lib",
  "packageVersion": "1.0.0"
}
```

Batch mode (`--all`) data shape:

```json
{
  "packages": [
    { "name": "@scope/core", "exports": 45, "coverage": 92, "lintIssues": 2, "health": 88 },
    { "name": "@scope/utils", "exports": 12, "coverage": 75, "lintIssues": 0, "health": 88 }
  ],
  "skipped": ["@scope/internal"]
}
```

### `drift health [entry]`

Documentation health score. This is the **default command** -- bare `drift` runs this.

| Flag | Type | Description |
|------|------|-------------|
| `--min <n>` | number | Minimum health threshold (exit 1 if below) |
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |

```bash
drift
drift health --min 80
drift health --all
```

Data shape:

```json
{
  "health": 85,
  "completeness": 88,
  "accuracy": 82,
  "totalExports": 25,
  "documented": 22,
  "undocumented": 3,
  "drifted": 2,
  "issues": [
    { "export": "createClient", "issue": "@returns type mismatch" }
  ],
  "packageName": "my-lib",
  "packageVersion": "1.0.0",
  "min": 80
}
```

### `drift ci`

CI checks on changed packages with GitHub integration.

| Flag | Type | Description |
|------|------|-------------|
| `--all` | boolean | Check all packages (not just changed) |
| `--private` | boolean | Include private packages |

```bash
drift ci
drift ci --all
```

Data shape:

```json
{
  "results": [
    {
      "name": "@scope/core",
      "coverage": 92,
      "coveragePass": true,
      "lintIssues": 0,
      "lintPass": true,
      "exports": 45,
      "pass": true
    }
  ],
  "pass": true,
  "min": 80,
  "skipped": ["@scope/internal"]
}
```

See [CI Integration](./ci-integration.md) for GitHub Actions setup.

---

## Analysis Commands

### `drift coverage [entry]`

Documentation coverage score.

| Flag | Type | Description |
|------|------|-------------|
| `--min <n>` | number | Minimum coverage threshold (exit 1 if below) |
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |

```bash
drift coverage
drift coverage --min 80
drift coverage --all
```

Data shape:

```json
{
  "score": 88,
  "documented": 22,
  "total": 25,
  "undocumented": ["parseConfig", "formatOutput", "validateInput"]
}
```

### `drift lint [entry]`

Cross-reference JSDoc against code for accuracy issues.

| Flag | Type | Description |
|------|------|-------------|
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |

```bash
drift lint
drift lint src/index.ts
drift lint --all
```

Data shape:

```json
{
  "issues": [
    {
      "export": "parseConfig",
      "issue": "@param 'options' type mismatch: documented as 'object', actual 'ParseOptions'",
      "location": "options",
      "filePath": "src/config.ts",
      "line": 42
    }
  ],
  "count": 1
}
```

Exit code 1 if any issues found. Disable lint with `lint: false` in config.

See [Drift Detection](./drift-detection.md) for details on drift types and categories.

### `drift examples [entry]`

Validate `@example` blocks on exports.

| Flag | Type | Description |
|------|------|-------------|
| `--typecheck` | boolean | Type-check examples with TypeScript |
| `--run` | boolean | Execute examples at runtime (implies `--typecheck`) |
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |
| `--min <n>` | number | Minimum example presence threshold (exit 1 if below) |

```bash
drift examples
drift examples --typecheck
drift examples --run
drift examples --min 50
```

Data shape:

```json
{
  "presence": {
    "total": 25,
    "withExamples": 18,
    "missing": ["parseConfig", "formatOutput"]
  },
  "typecheck": {
    "total": 18,
    "passed": 16,
    "failed": 2,
    "errors": [...]
  }
}
```

---

## Extraction Commands

### `drift extract [entry]`

Extract full API spec as JSON.

| Flag | Type | Description |
|------|------|-------------|
| `-o, --output <file>` | string | Write JSON to file instead of stdout |
| `--only <patterns>` | string | Include exports matching glob (comma-separated) |
| `--ignore <patterns>` | string | Exclude exports matching glob (comma-separated) |
| `--max-depth <n>` | number | Max type resolution depth (default: 10) |
| `--all` | boolean | Extract from all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |

```bash
drift extract
drift extract -o api-spec.json
drift extract --only "parse*,format*"
drift extract --all
```

### `drift list [searchOrEntry]`

List exports. Positional arg is a search term or entry file path.

| Flag | Type | Description |
|------|------|-------------|
| `--kind <kinds>` | string | Filter by kind (comma-separated: function,class,interface,...) |
| `--undocumented` | boolean | Only exports missing JSDoc |
| `--drifted` | boolean | Only exports with stale JSDoc |
| `--full` | boolean | Show full list (no truncation) |
| `--all` | boolean | Run across all workspace packages |

```bash
drift list
drift list parse
drift list --kind function,class
drift list --undocumented
drift list --drifted
```

Data shape:

```json
{
  "exports": [
    { "name": "parseConfig", "kind": "function", "description": "Parse configuration" },
    { "name": "Client", "kind": "class", "deprecated": true }
  ],
  "search": "parse",
  "showAll": false
}
```

### `drift get <name> [entry]`

Inspect single export detail and types.

```bash
drift get parseConfig
drift get Client src/index.ts
```

---

## Spec Operations

### `drift validate <spec>`

Validate a spec file against the schema.

```bash
drift validate api-spec.json
```

### `drift filter <spec>`

Filter exports in a spec by kind, search, or tag.

```bash
drift filter api-spec.json --kind function
```

---

## Comparison Commands

### `drift diff [old] [new]`

Show what changed between two specs. Exits 1 if breaking changes detected.

| Flag | Type | Description |
|------|------|-------------|
| `--base <ref>` | string | Git ref for old spec |
| `--head <ref>` | string | Git ref for new spec (default: working tree) |
| `--entry <file>` | string | Entry file for git ref extraction |

```bash
drift diff api-v1.json api-v2.json
drift diff --base main
drift diff --base main --head feature
```

### `drift breaking [old] [new]`

Detect breaking changes between two specs. Exits 1 if breaking changes found.

| Flag | Type | Description |
|------|------|-------------|
| `--base <ref>` | string | Git ref for old spec |
| `--head <ref>` | string | Git ref for new spec (default: working tree) |
| `--entry <file>` | string | Entry file for git ref extraction |

```bash
drift breaking api-v1.json api-v2.json
drift breaking --base main
```

### `drift semver [old] [new]`

Recommend semver bump based on API changes.

| Flag | Type | Description |
|------|------|-------------|
| `--base <ref>` | string | Git ref for old spec |
| `--head <ref>` | string | Git ref for new spec (default: working tree) |
| `--entry <file>` | string | Entry file for git ref extraction |

```bash
drift semver api-v1.json api-v2.json
drift semver --base main
```

### `drift changelog [old] [new]`

Generate changelog from API diff.

| Flag | Type | Description |
|------|------|-------------|
| `--format <fmt>` | string | Output format: md or json (default: md) |
| `--base <ref>` | string | Git ref for old spec |
| `--head <ref>` | string | Git ref for new spec (default: working tree) |
| `--entry <file>` | string | Entry file for git ref extraction |

```bash
drift changelog api-v1.json api-v2.json
drift changelog --base main --format json
```

---

## Release and Reporting

### `drift release [entry]`

Pre-publish documentation audit. Checks coverage threshold and lint. Exit code 1 if not release-ready.

```bash
drift release
```

Data shape:

```json
{
  "ready": true,
  "coverage": 92,
  "coveragePass": true,
  "lintIssues": 0,
  "lintPass": true,
  "total": 45,
  "documented": 41,
  "undocumented": ["internalHelper"],
  "reasons": [],
  "lastTag": "v1.2.0",
  "pkgVersion": "1.3.0",
  "min": 80
}
```

### `drift report`

Documentation trends from history data.

```bash
drift report
```

---

## Setup Commands

### `drift init`

Create a `drift.config.json` configuration file.

```bash
drift init
```

### `drift config`

Manage drift configuration. See [Configuration](./configuration.md) for full details.

```bash
drift config list
drift config get coverage.min
drift config set coverage.min 80
drift config set coverage.min 80 --project
```

### `drift context [entry]`

Generate agent context file with project state.

| Flag | Type | Description |
|------|------|-------------|
| `--all` | boolean | Include all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |
| `--output <path>` | string | Output path (default: `~/.drift/projects/<slug>/context.md`) |

```bash
drift context
drift context --all
drift context --output ./context.md
```

### `drift cache`

Cache management (clear, status).

```bash
drift cache clear
drift cache status
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | Threshold not met, lint issues found, or command error |

## Discovery

```bash
# Machine-readable JSON of all commands, flags, entities, and workflows
drift --capabilities
```

Useful for AI agents and tooling integration. Returns command metadata, entity operations, and suggested workflows.
