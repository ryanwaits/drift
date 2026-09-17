# Drift GitHub Action

Runs `drift` — the same check as local. Posts a PR comment and step summary. Zero network, no model.

## Quick Start

```yaml
- uses: actions/checkout@v4
- uses: ryanwaits/drift/action@v1
  with:
    min-coverage: 80
```

If `drift.docs.json` is committed, key coverage runs automatically.

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | GitHub token for PR comments | `${{ github.token }}` |
| `working-directory` | Working directory | `.` |
| `min-coverage` | Minimum coverage % (empty = config) | `''` |
| `check-all` | Check all workspace packages (`--all`) | `false` |
| `include-private` | Include private packages | `false` |

## Permissions

```yaml
permissions:
  contents: read
  pull-requests: write
```
