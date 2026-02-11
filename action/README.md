# Drift GitHub Action

Documentation coverage, drift detection, and docs sync for TypeScript projects.

## Usage

```yaml
name: Drift
on:
  pull_request:
    types: [opened, synchronize, closed]

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: driftdev/drift/action@v1
        with:
          anthropic-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | GitHub token for PR comments | `${{ github.token }}` |
| `working-directory` | Working directory for the check | `.` |
| `min-coverage` | Minimum coverage percentage (0-100) | `80` |
| `check-all` | Check all packages, not just changed | `false` |
| `include-private` | Include private packages | `false` |
| `anthropic-key` | Anthropic API key for docs sync on merge | `''` |
| `docs-sync` | Enable docs sync on merge | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `coverage` | Current coverage percentage |
| `health` | Current health score |

## What it does

### On pull requests
- Auto-detects changed packages via `git diff`
- Runs coverage + lint checks
- Diffs API against base branch (added, changed, breaking)
- Reports undocumented exports
- Posts structured PR comment with collapsible sections
- Writes GitHub step summary

### On merge (with `anthropic-key`)
- Detects breaking changes in the merged PR
- Reads `docs.remote` targets from `drift.config.json`
- Clones each target repo and uses Claude to update docs
- Creates PRs on target repos with the fixes

## Docs sync

Docs sync requires:
1. An `anthropic-key` input (Anthropic API key)
2. `docs.remote` configured in `drift.config.json`:

```json
{
  "docs": {
    "remote": [
      { "repo": "org/docs-repo", "branch": "main" }
    ]
  }
}
```

3. A `github-token` with push access to the target repos (default `GITHUB_TOKEN` is scoped to the current repo — use a PAT or GitHub App token for cross-repo access)

## Requirements

- `fetch-depth: 0` on checkout (needed for base ref comparison)
- `pull_request` event with `closed` type (for merge detection)

## License

MIT
