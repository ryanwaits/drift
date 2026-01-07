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
doccov check src/index.ts --min-health 80
doccov check --format json -o report.json
doccov check --examples typecheck    # Validate @example blocks
doccov check --fix                   # Auto-fix drift issues
```

#### Monorepo / Batch Mode

Analyze multiple packages at once using glob patterns or multiple targets:

```bash
# Glob pattern - analyze all packages
doccov check "packages/*/src/index.ts"

# Multiple explicit targets
doccov check packages/server/src/index.ts packages/client/src/index.ts

# With options
doccov check "packages/*/src/index.ts" --format markdown --min-health 60
```

Output shows per-package breakdown with aggregated totals:

```
Documentation Coverage Report (3 packages)

| Package | Health | Exports | Drift |
|---------|--------|---------|-------|
| @pkg/server | 75% | 78 | 4 |
| @pkg/client | 82% | 45 | 2 |
| @pkg/core | 90% | 32 | 1 |
| Total | 81% | 155 | 7 |

✓ Check passed (health 81% >= 80%)
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

Create `doccov.config.ts` or use `doccov init`:

```ts
// doccov.config.ts
import { defineConfig } from '@doccov/cli';

export default defineConfig({
  check: {
    minHealth: 80,
    examples: ['presence', 'typecheck'],

    // Documentation style presets
    style: 'minimal',  // 'minimal' | 'verbose' | 'types-only'

    // Fine-grained requirements (override preset)
    require: {
      description: true,
      params: false,
      returns: false,
      examples: false,
    },
  },
  docs: {
    include: ['docs/**/*.md'],
  },
});
```

### Style Presets

Different projects have different documentation standards. Use `style` to choose a preset:

| Preset | description | params | returns | examples |
|--------|-------------|--------|---------|----------|
| `minimal` | required | optional | optional | optional |
| `verbose` | required | required | required | optional |
| `types-only` | optional | optional | optional | optional |

- **minimal** (default): Only requires description. Good for projects relying on TypeScript types.
- **verbose**: Requires description, @param, and @returns. For comprehensive API documentation.
- **types-only**: No requirements. Score is 100% if exports exist. For TypeScript-first projects.

Use `require` to override individual rules from the preset:

```ts
// Start with minimal, but also require examples
{
  style: 'minimal',
  require: {
    examples: true,
  }
}
```

## Output Formats

All commands support multiple output formats:

- `text` (default) - Human-readable terminal output
- `json` - Machine-readable JSON
- `markdown` - Markdown report
- `github` - GitHub Actions annotations

## License

MIT
