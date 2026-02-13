# Drift GitHub Action

Documentation coverage, drift detection, and docs sync for TypeScript projects.

## Who Should Use This Action

- Teams that merge TypeScript API changes via pull requests.
- Repos where docs quality should be enforced before merge.
- Maintainers who want automated docs follow-up on breaking changes.

## Why Use It

- Turns docs quality into a standard CI gate.
- Adds structured PR feedback instead of ad-hoc review comments.
- Extends to merge/release workflows for docs sync and release checks.

## How To Adopt It

1. Add the action to `pull_request` workflows.
2. Set `min-coverage` to your current baseline.
3. Enable optional merge/release workflows (`docs-pr`, `docs-issue`, `release-gate`) as needed.

## Quick Start

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: ryanwaits/drift/action@v1
```

That's it for PR checks. Add inputs to enable merge/release workflows.

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | GitHub token for PR comments and cross-repo ops | `${{ github.token }}` |
| `working-directory` | Working directory for drift commands | `.` |
| `min-coverage` | Minimum coverage percentage (0-100) | `80` |
| `check-all` | Check all packages, not just changed | `false` |
| `include-private` | Include private packages | `false` |
| `validate-examples` | Type-check `@example` JSDoc blocks on PRs | `false` |
| `anthropic-key` | Anthropic API key (required for `docs-pr`) | `''` |
| `docs-pr` | AI-generated PRs on remote docs repos on merge | `false` |
| `docs-issue` | Create issues on remote docs repos on merge | `false` |
| `release-gate` | Validate coverage/lint readiness on release publish | `false` |
| `release-changelog` | Append API changelog to GitHub Release body | `false` |

## Workflows

### PR Workflows (`pull_request` open/synchronize)

**`drift ci`** — always runs on PR open/sync. Performs:
- Auto-detects changed packages via `git diff`
- Runs coverage + lint checks
- Diffs API against base branch (added, changed, breaking)
- Reports undocumented exports
- Posts structured PR comment with collapsible sections
- Writes GitHub step summary
- Respects `check-all`, `include-private`, `min-coverage`

**`validate-examples`** — opt-in. Runs `drift examples --typecheck` to type-check `@example` JSDoc blocks. Respects `check-all` and `include-private`.

### Merge Workflows (`pull_request` closed/merged)

Both require `docs.remote` in your drift config (see [Configuration](#configuration)). Both only trigger when breaking changes are detected.

**`docs-pr`** — AI-generated PRs. Requires `anthropic-key`. Uses Claude Agent SDK (claude-sonnet-4-5) to:
1. Clone each target docs repo
2. Search for references to broken exports
3. Edit docs to match new API
4. Push branch and open PR on target repo

**`docs-issue`** — lightweight alternative. No AI needed. Creates GitHub issues on target repos with:
- List of breaking changes
- Search terms for manual lookup
- Copy-pasteable prompt for agent-assisted fixes

> Use `docs-pr` for fully automated fixes. Use `docs-issue` for a human-in-the-loop workflow. You can enable both.

### Release Workflows (`release` publish)

**`release-gate`** — runs `drift release` to validate coverage and lint readiness before release. Fails the workflow if checks don't pass. Respects `check-all`.

**`release-changelog`** — appends API changelog to the GitHub Release body. Compares the release tag against the previous tag using `drift changelog --format md`.

## Full Example

```yaml
name: Drift
on:
  pull_request:
    types: [opened, synchronize, closed]
  release:
    types: [published]

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ryanwaits/drift/action@v1
        with:
          github-token: ${{ secrets.CROSS_REPO_TOKEN }}
          min-coverage: 90
          check-all: true
          include-private: true
          validate-examples: true
          anthropic-key: ${{ secrets.ANTHROPIC_API_KEY }}
          docs-pr: true
          docs-issue: true
          release-gate: true
          release-changelog: true
```

## Requirements

### Checkout depth

`fetch-depth: 0` is required on `actions/checkout` for base ref comparison and tag history.

### Event types

- `pull_request` must include `closed` type for merge detection (`docs-pr`, `docs-issue`)
- `release` event must include `published` type for release workflows

### Tokens and permissions

| Workflow | Token requirement |
|----------|-------------------|
| `drift ci` | Default `GITHUB_TOKEN` (write PRs, read repo) |
| `validate-examples` | None |
| `docs-pr` | Cross-repo PAT or GitHub App token (push + PR access to target repos) |
| `docs-issue` | Cross-repo PAT or GitHub App token (issue access to target repos) |
| `release-gate` | None |
| `release-changelog` | `GITHUB_TOKEN` with `contents: write` (edits release body) |

The default `GITHUB_TOKEN` is scoped to the current repo. For cross-repo operations (`docs-pr`, `docs-issue`), use a Personal Access Token or GitHub App installation token passed via `github-token`.

### API keys

`docs-pr` requires `anthropic-key` — an Anthropic API key with access to Claude Sonnet. Pass it via `${{ secrets.ANTHROPIC_API_KEY }}`.

## Configuration

Merge workflows (`docs-pr`, `docs-issue`) read target repos from `docs.remote` in your drift config.

**`drift.config.json`:**

```json
{
  "docs": {
    "remote": [
      { "repo": "org/docs-repo", "branch": "main" },
      { "repo": "org/another-docs-repo" }
    ]
  }
}
```

**Or `package.json`:**

```json
{
  "drift": {
    "docs": {
      "remote": [
        { "repo": "org/docs-repo", "branch": "main" }
      ]
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `repo` | Yes | `owner/repo` format |
| `branch` | No | Target branch to clone (defaults to repo default branch) |

## License

MIT
