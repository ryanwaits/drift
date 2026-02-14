# Drift Detection

Drift is when your documentation says one thing but your code does another. Drift detects these mismatches by comparing JSDoc annotations and markdown docs against actual TypeScript signatures.

## Who This Is For

- Maintainers debugging why `drift lint` or `drift scan` failed.
- Teams defining a shared policy for docs quality issues.
- Engineers deciding which drift classes should block merge.

## Why This Matters

- It converts vague "docs look wrong" feedback into concrete, typed issues.
- It gives file/line-level diagnostics that can be fixed quickly.
- It helps teams separate high-risk drift (signature mismatch) from lower-risk gaps.

## How To Use This Page

1. Learn the drift categories below.
2. Map your common failures to a category.
3. Set team expectations for which categories must be fixed before merge.

## How It Works

1. **Extract** -- Drift parses your TypeScript entry point and builds a spec of all exports with their signatures, types, JSDoc, and `@example` blocks.
2. **Compare** -- Each export's documentation is cross-referenced against its actual code signature.
3. **Report** -- Mismatches are reported with the export name, issue description, file path, and line number.

## The 4 Drift Categories

### Structural

Signature and type mismatches between JSDoc and code.

| Drift Type | Description |
|------------|-------------|
| `param-mismatch` | `@param` name doesn't match any parameter in the signature |
| `param-type-mismatch` | `@param` type doesn't match actual parameter type |
| `return-type-mismatch` | `@returns` type doesn't match actual return type |
| `optionality-mismatch` | `@param` marks a required param as optional or vice versa |
| `generic-constraint-mismatch` | `@template` constraint doesn't match actual generic constraint |
| `property-type-drift` | Documented property type doesn't match actual type |
| `async-mismatch` | JSDoc says sync but function is async, or vice versa |

### Semantic

Metadata and visibility mismatches.

| Drift Type | Description |
|------------|-------------|
| `deprecated-mismatch` | `@deprecated` tag present but export isn't deprecated, or vice versa |
| `visibility-mismatch` | JSDoc visibility (`@internal`, `@private`, etc.) conflicts with code visibility |
| `broken-link` | `{@link SomeExport}` in JSDoc references a non-existent export |

### Example

Issues with `@example` code blocks.

| Drift Type | Description |
|------------|-------------|
| `example-drift` | Example imports or references non-existent exports |
| `example-syntax-error` | Example has syntax errors |
| `example-runtime-error` | Example throws at runtime (requires `--run`) |
| `example-assertion-failed` | Example assertion comment doesn't match actual output (requires `--run`) |

### Prose

Broken references in markdown documentation.

| Drift Type | Description |
|------------|-------------|
| `prose-broken-reference` | Markdown code block imports a name that doesn't exist in package exports |

## Using `drift lint`

`drift lint` runs all drift detection and reports issues:

```bash
drift lint
```

Output includes file path and line number for each issue:

```
  3 issues found

  parseConfig    @param 'options' type mismatch: documented as 'object', actual 'ParseOptions'
                 src/config.ts:42

  createClient   @returns type mismatch: documented as 'Client', actual 'Promise<Client>'
                 src/client.ts:15

  README.md:28   Import 'formatJSON' from 'my-lib' does not exist in package exports
                 Did you mean 'formatJson'?
```

JSON output:

```json
{
  "ok": true,
  "data": {
    "issues": [
      {
        "export": "parseConfig",
        "issue": "@param 'options' type mismatch: documented as 'object', actual 'ParseOptions'",
        "location": "options",
        "filePath": "src/config.ts",
        "line": 42
      },
      {
        "export": "",
        "issue": "Import 'formatJSON' from 'my-lib' does not exist in package exports",
        "location": "Did you mean 'formatJson'?",
        "filePath": "README.md",
        "line": 28
      }
    ],
    "count": 2
  },
  "meta": { "command": "lint", "duration": 450, "version": "0.38.0" },
  "next": { "suggested": "drift-fix skill", "reason": "2 issues found" }
}
```

Exit code 1 when issues are found. Disable lint entirely with `lint: false` in [config](./configuration.md).

## Using `drift scan`

`drift scan` includes lint as part of its combined pass (coverage + lint + prose drift + health). Same drift detection, bundled with coverage and health scoring. See [CLI Reference](./cli-reference.md#drift-scan-entry).

## Prose Drift Detection

Prose drift scans your markdown files for code blocks that import from your package. If an imported name doesn't exist in the package's exports, it's flagged as `prose-broken-reference`.

Drift includes fuzzy matching -- if you import `formatJSON` but the actual export is `formatJson`, the suggestion will say "Did you mean 'formatJson'?".

### Configuring Markdown Discovery

By default, drift scans:
- `README.md`
- `docs/**/*.md`
- `docs/**/*.mdx`

And excludes:
- `node_modules/**`
- `dist/**`
- `.git/**`

Override with the `docs` config key:

```json
{
  "docs": {
    "include": ["README.md", "docs/**/*.md", "guides/**/*.md"],
    "exclude": ["node_modules/**", "dist/**"]
  }
}
```

See [Configuration](./configuration.md) for config file locations.

## Monorepo Mode

Run lint across all workspace packages:

```bash
drift lint --all
drift lint --all --private
```

Batch output shows per-package issue counts:

```json
{
  "packages": [
    { "name": "@scope/core", "exports": 45, "issues": 3 },
    { "name": "@scope/utils", "exports": 12, "issues": 0 }
  ],
  "aggregate": { "count": 3 }
}
```

