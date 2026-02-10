# Drift GitHub Action

Documentation coverage and drift detection for TypeScript projects.

Thin wrapper around `drift ci` — installs the CLI and runs it.

## Usage

```yaml
name: Docs Coverage
on: [push, pull_request]

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: driftdev/drift@v1
        with:
          min-coverage: 80
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | GitHub token for PR comments | `${{ github.token }}` |
| `working-directory` | Working directory for the check | `.` |
| `min-coverage` | Minimum coverage percentage (0-100) | `80` |
| `check-all` | Check all packages, not just changed | `false` |
| `include-private` | Include private packages | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `coverage` | Current coverage percentage |
| `health` | Current health score |

## What `drift ci` does

- Auto-detects changed packages via `git diff`
- Runs coverage + lint checks
- Posts PR comments with results
- Writes GitHub step summaries
- Appends to history

## License

MIT
