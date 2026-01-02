# @doccov/cli

Command-line interface for documentation coverage analysis and drift detection.

## Install

```bash
npm install -g @doccov/cli
```

## Quick Start

```bash
# Check documentation coverage
doccov check src/index.ts

# Generate OpenPkg spec
doccov spec src/index.ts -o .doccov

# Get package info
doccov info src/index.ts
```

## Commands

| Command | Description |
|---------|-------------|
| `check` | Analyze coverage and detect drift |
| `spec` | Generate OpenPkg + DocCov specs |
| `diff` | Compare two specs for breaking changes |
| `info` | Show brief coverage summary |
| `trends` | View historical coverage trends |
| `init` | Create configuration file |

### check

Analyze documentation coverage against thresholds.

```bash
doccov check src/index.ts --min-coverage 80
doccov check --format json -o report.json
doccov check --examples typecheck    # Validate @example blocks
doccov check --fix                   # Auto-fix drift issues
```

### spec

Generate specification files.

```bash
doccov spec src/index.ts -o .doccov
doccov spec --format api-surface     # Human-readable output
doccov spec --runtime                # Extract Zod/Valibot schemas
```

### diff

Compare specs and detect breaking changes.

```bash
doccov diff main.json feature.json
doccov diff --recommend-version      # Suggest semver bump
doccov diff --format github          # PR comment format
```

### info

Quick coverage overview.

```bash
doccov info src/index.ts
# @stacks/transactions@7.3.1
#   Exports:    413
#   Coverage:   13%
#   Drift:      13%
```

### trends

View coverage history over time.

```bash
doccov trends --cwd ./my-package
doccov trends --record               # Save current coverage
doccov trends --extended             # Show velocity/projections
```

## Configuration

Create `doccov.config.yaml` or use `doccov init`:

```yaml
check:
  minCoverage: 80
  maxDrift: 10
  examples: [presence, typecheck]

docs:
  include:
    - "docs/**/*.md"
```

## Output Formats

All commands support multiple output formats:

- `text` (default) - Human-readable terminal output
- `json` - Machine-readable JSON
- `markdown` - Markdown report
- `github` - GitHub Actions annotations

## License

MIT
