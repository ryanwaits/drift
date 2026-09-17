# GitHub Action

Package: `ryanwaits/drift/action`. Runs `drift`. Posts a PR comment and a step summary. Zero network.

```yaml
- uses: ryanwaits/drift/action@v1
  with:
    min-coverage: 80
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | PR comments | `${{ github.token }}` |
| `working-directory` | Cwd | `.` |
| `min-coverage` | Coverage floor (empty = config) | `''` |
| `check-all` | `drift --all` | `false` |
| `include-private` | Include private packages | `false` |

`drift.docs.json` auto-loads when committed.
