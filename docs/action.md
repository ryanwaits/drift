# GitHub Action

Drop `drift ci` into a GitHub Actions workflow and every pull request gets checked automatically — coverage, lint, and prose drift, with the result posted straight to the PR.

## Who This Is For

- Repos that want docs quality enforced on every PR without a manual step.
- Teams who want a results table in the PR instead of digging through CI logs.
- Maintainers who want a step summary in the Actions UI for a quick pass/fail glance.

## Why Use It

- Zero extra infrastructure — it's a CLI command running inside GitHub's own runners.
- Same `drift ci` binary as local/other-CI usage, so behavior is identical everywhere.
- Comments update in place on new pushes instead of piling up duplicate comments.

## The Workflow

```yaml
name: Drift CI
on: [pull_request]

jobs:
  drift:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # needed for changed-file detection

      - uses: oven-sh/setup-bun@v2

      - run: bun install

      - run: bunx drift ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`permissions.pull-requests: write` is required — that's what lets the action post and update the PR comment. `fetch-depth: 0` is required for changed-package detection to work against the base branch.

## What It Does

1. **Detects changed packages** — diffs against the base branch so only touched workspace packages get checked (unless `--all` is passed).
2. **Runs coverage + lint** on each changed package.
3. **Posts a PR comment** with a results table, creating it on first run and updating it on every subsequent push.
4. **Writes a GitHub step summary**, visible right in the Actions UI.
5. **Appends to history** for trend tracking across runs.

## The PR Comment

```
## Drift CI Results

| Package | Exports | Coverage | Lint | Status |
|---------|---------|----------|------|--------|
| @scope/core | 45 | 92% | 0 issues | Pass |
| @scope/utils | 12 | 75% | 2 issues | Fail |

**Some checks failed.**
```

## Going Further

For thresholds, `--all` full-repo gates, non-GitHub CI providers, and the full flag reference, see [CI Integration](./ci-integration.md).
