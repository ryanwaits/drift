# CI Integration

`drift ci` is purpose-built for CI pipelines. It detects changed packages, runs coverage + lint, posts PR comments, writes GitHub step summaries, and tracks history.

## Who This Is For

- Teams shipping TypeScript packages through pull requests.
- Repos where docs drift should block merge.
- Engineering teams that want per-package docs quality signals in monorepos.

## Why Run Drift In CI

- Catch stale docs at review time instead of after release.
- Enforce a consistent documentation quality bar with thresholds.
- Produce actionable output (package, export, file, line) for fast fixes.

## How To Adopt

1. Start with `drift ci` on pull requests.
2. Set `coverage.min` (or `--min`) to your baseline threshold.
3. Turn on `--all` for full-repo gates once package-level quality is stable.

## GitHub Actions

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
          fetch-depth: 0  # needed for changed-file detection

      - uses: oven-sh/setup-bun@v2

      - run: bun install

      - run: bunx drift ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### What `drift ci` Does

1. **Detects changed packages** -- Uses `git diff` against the base branch to find which workspace packages have changes. Only those packages are checked (unless `--all` is passed).
2. **Runs coverage + lint** on each package.
3. **Posts a PR comment** with a results table (creates or updates a single comment).
4. **Writes a GitHub step summary** visible in the Actions UI.
5. **Appends to history** in `~/.drift/` for trend tracking.
6. **Generates context.md** -- a machine-readable project state file in `~/.drift/projects/<slug>/context.md`.

### PR Comment

The PR comment is a markdown table:

```
## Drift CI Results

| Package | Exports | Coverage | Lint | Status |
|---------|---------|----------|------|--------|
| @scope/core | 45 | 92% | 0 issues | Pass |
| @scope/utils | 12 | 75% | 2 issues Fail | Fail |

**Some checks failed.**
```

The comment is created on first run and updated on subsequent pushes (no duplicate comments).

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All packages pass coverage threshold and lint |
| 1 | At least one package fails coverage or lint |

Coverage threshold comes from `coverage.min` in [config](./configuration.md) (default: 0, meaning any coverage passes).

## Flags

| Flag | Description |
|------|-------------|
| `--all` | Check all packages, not just changed ones |
| `--private` | Include private packages |

## Environment Variables

`drift ci` reads standard GitHub Actions environment variables:

| Variable | Used For |
|----------|----------|
| `GITHUB_TOKEN` | Posting PR comments |
| `GITHUB_REPOSITORY` | Target repo for PR comment API |
| `GITHUB_EVENT_PATH` | Extracting PR number |
| `GITHUB_SHA` | Commit SHA for history tracking |
| `GITHUB_BASE_REF` | Base branch for changed-file detection |

These are all provided automatically in GitHub Actions. No manual setup required.

## Monorepo Support

In a monorepo, `drift ci` automatically:
- Discovers workspace packages from `package.json` workspace globs.
- Filters to only changed packages (based on `git diff`).
- Skips private packages unless `--private` is set.
- Skips packages with no detectable TypeScript entry point.
- Reports per-package results.

```bash
# Only changed packages (default in PR context)
drift ci

# All packages
drift ci --all

# Include private packages
drift ci --all --private
```

## JSON Output

```json
{
  "ok": true,
  "data": {
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
  },
  "meta": { "command": "ci", "duration": 2340, "version": "0.38.0" }
}
```

## History Tracking

Each CI run appends a record per package to `~/.drift/` history:

```json
{
  "date": "2025-01-15",
  "package": "@scope/core",
  "coverage": 92,
  "lint": 0,
  "exports": 45,
  "commit": "abc1234"
}
```

Use `drift report` to view trends, or `drift context` to generate a machine-readable context file from this history.

## Context Generation

`drift ci` automatically writes a `context.md` file to `~/.drift/projects/<slug>/context.md`. This file contains:
- Per-package coverage and lint status
- History trends
- Current config
- Commit SHA

Generate it manually with:

```bash
drift context
drift context --all
drift context --output ./my-context.md
```

## Non-GitHub CI

`drift ci` works outside GitHub Actions -- it just skips PR comments and step summaries. Coverage, lint, history tracking, and exit codes all work the same. The JSON output is the canonical result format regardless of CI provider.
