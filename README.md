# drift

> Know when your TypeScript docs lie.

Documentation quality primitives for TypeScript. 11 atomic commands that give AI agents structured understanding of your API.

## Quick Start

```bash
# Check documentation coverage
drift coverage src/index.ts

# Find JSDoc issues (param mismatches, broken links, type errors)
drift lint src/index.ts

# List all exports
drift list src/index.ts
```

Entry auto-detects from `package.json` — just `drift coverage` in any TypeScript project.

## Commands

### Extraction

| Command | Description |
|---------|-------------|
| `drift extract [entry]` | Extract full API spec as JSON |
| `drift list [entry]` | List all exports with kinds |
| `drift get <name> [entry]` | Get single export detail + types |

### Spec Operations

| Command | Description |
|---------|-------------|
| `drift validate <spec.json>` | Validate a spec file |
| `drift filter <spec.json>` | Filter exports by `--kind`, `--search`, `--tag` |

### Analysis

| Command | Description |
|---------|-------------|
| `drift coverage [entry]` | Documentation coverage score + undocumented list |
| `drift lint [entry]` | Cross-reference JSDoc vs code for accuracy issues |

### Comparison

| Command | Description |
|---------|-------------|
| `drift diff <old> <new>` | What changed between two specs |
| `drift breaking <old> <new>` | Detect breaking changes (exit 1 if found) |
| `drift semver <old> <new>` | Recommend semver bump |
| `drift changelog <old> <new>` | Generate changelog (markdown or JSON) |

## Output

All commands output `{ok, data, meta}` JSON to stdout. Human-readable summary goes to stderr.

```bash
# Pipe to jq
drift coverage 2>/dev/null | jq '.data.score'

# Check exit codes in CI
drift lint || echo "Issues found"
drift coverage --min 80 || echo "Below threshold"
```

## How It Works

```
TypeScript source
    |  drift extract
    v
openpkg.json spec    (portable API structure)
    |  drift lint / coverage / diff
    v
structured facts     (JSON to stdout)
```

drift extracts a machine-readable spec from your TypeScript, then runs analysis against it. Every command outputs facts — agents decide what to do with them.

## Agent Skills

drift is designed for AI agents. Skills teach agents to compose primitives into workflows:

| Skill | What it does |
|-------|-------------|
| `/drift-fix` | Find lint issues, fix JSDoc to match actual signatures |
| `/drift-enrich` | Add JSDoc to undocumented exports |
| `/drift-scan` | Scan markdown docs for stale API references |
| `/drift-review` | Review a PR for documentation impact |
| `/drift-release` | Pre-release documentation audit |

## CI Example

```bash
# Fail if coverage below 80% or any lint issues
drift coverage --min 80
drift lint
```

## Philosophy

- Every command is an atomic primitive — one input, one output, one job
- No bundled workflows — agents compose primitives via skills
- No config files — auto-detect entry points, flags for overrides
- Primitives output facts, not analysis — agents are smart enough to categorize

## Architecture

```
Layer 0: @openpkg-ts/spec   (open standard)
Layer 1: @openpkg-ts/sdk    (extraction engine)
Layer 2: drift CLI           (11 atomic primitives)
Layer 3: drift skills        (agent workflow instructions)
```

## License

MIT
