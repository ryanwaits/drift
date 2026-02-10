# Drift GitHub Action

Check documentation coverage and detect drift in TypeScript projects.

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
          require-examples: false
          comment-on-pr: true
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `min-coverage` | Minimum coverage percentage (0-100) | `80` |
| `require-examples` | Require @example blocks on all exports | `false` |
| `strict` | Fail conditions (preset or custom checks) | `''` |
| `docs-glob` | Glob pattern for markdown docs to check for impact | `''` |
| `comment-on-pr` | Post coverage report as PR comment | `true` |
| `working-directory` | Working directory for the check | `.` |
| `github-token` | GitHub token for PR comments | `${{ github.token }}` |

## Strict Mode

Control when the action fails using presets or custom check combinations:

| Preset | Checks | Use Case |
|--------|--------|----------|
| `ci` | breaking, regression | Default CI protection |
| `release` | breaking, regression, drift, docs-impact, undocumented | Pre-release validation |
| `quality` | drift, undocumented | Documentation hygiene |

### Examples

```yaml
# Use a preset
- uses: driftdev/drift@v1
  with:
    strict: ci

# Custom checks
- uses: driftdev/drift@v1
  with:
    strict: "breaking,drift"
```

### Available Checks

- `breaking` - Fail if breaking changes are detected
- `regression` - Fail if coverage decreases
- `drift` - Fail if new drift issues are introduced
- `undocumented` - Fail if new exports are undocumented
- `docs-impact` - Fail if changes impact existing documentation

## PR Comments

When `comment-on-pr` is enabled, the action posts a comment on PRs with:

- Coverage percentage change
- New undocumented exports
- Drift issues introduced/resolved

## Badge

Add a coverage badge to your README:

```markdown
![Drift](https://api.driftdev.com/badge/your-org/your-repo)
```

## License

MIT
