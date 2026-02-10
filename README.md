# drift

> Your code changed. Your docs didn't.

Detect documentation drift in TypeScript projects. 21 commands that catch when JSDoc, examples, and markdown fall out of sync with your actual API.

## Quick Start

```bash
# Full scan: coverage + lint + prose drift + health
drift scan

# Check documentation coverage
drift coverage

# Find JSDoc issues (param mismatches, broken links, type errors)
drift lint

# List all exports
drift list
```

Entry auto-detects from `package.json` — just `drift scan` in any TypeScript project.

## Commands

### Composed (Human Surface)

| Command | Description |
|---------|-------------|
| `drift scan [entry]` | Coverage + lint + prose drift + health in one pass |
| `drift health [entry]` | Documentation health score (default command) |
| `drift ci` | Run CI checks on changed packages |

### Analysis (Agent Primitives)

| Command | Description |
|---------|-------------|
| `drift coverage [entry]` | Documentation coverage score + undocumented list |
| `drift lint [entry]` | Cross-reference JSDoc vs code for accuracy issues |
| `drift examples [entry]` | Validate @example blocks (presence, typecheck, run) |

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

### Comparison

| Command | Description |
|---------|-------------|
| `drift diff <old> <new>` | What changed between two specs |
| `drift breaking <old> <new>` | Detect breaking changes (exit 1 if found) |
| `drift semver <old> <new>` | Recommend semver bump |
| `drift changelog <old> <new>` | Generate changelog (markdown or JSON) |

### Plumbing

| Command | Description |
|---------|-------------|
| `drift report` | Documentation trends from history |
| `drift release` | Pre-release documentation audit |
| `drift context` | Generate agent-readable project state |
| `drift init` | Create configuration file |
| `drift config` | Manage configuration (list, get, set) |
| `drift cache` | Cache management |

## Output

All commands output `{ok, data, meta}` JSON to stdout. Human-readable output when running in a terminal.

```bash
# Pipe to jq
drift coverage --json 2>/dev/null | jq '.data.score'

# Check exit codes in CI
drift lint || echo "Issues found"
drift coverage --min 80 || echo "Below threshold"
```

## AI Agent Usage

drift ships as a [Claude Code skill](https://docs.anthropic.com/en/docs/claude-code). Install the skill, then use `/drift` inside any TypeScript project:

```
/drift              # status check, auto-init if needed
/drift fix          # lint → fix JSDoc to match actual signatures
/drift enrich       # coverage → add missing JSDoc
/drift review       # PR documentation impact analysis
/drift release      # pre-release documentation audit
/drift docs/        # scan external docs for stale API references
```

Detection is the tool's job. Mutation is the agent's job. The CLI outputs structured JSON with `filePath` and `line` — agents read the diagnosis, then edit code directly.

```bash
# Machine-readable command discovery
drift --capabilities
```

## Drift Detection

15 drift types across 4 categories:

| Category | Types | Description |
|----------|-------|-------------|
| **structural** | 7 | JSDoc types/params don't match code signature |
| **semantic** | 3 | Deprecation, visibility, broken `{@link}` references |
| **example** | 4 | @example code has errors or doesn't work |
| **prose** | 1 | Markdown docs import/reference non-existent exports |

Every drift issue includes `filePath` and `line` for agent-driven fixes.

## How It Works

```
TypeScript source
    |  drift extract
    v
openpkg.json spec    (portable API structure)
    |  drift scan / lint / coverage / diff
    v
structured facts     (JSON to stdout)
    |
    v
.drift/context.md    (agent-readable project state)
```

drift extracts a machine-readable spec from your TypeScript, then runs analysis against it. Every command outputs facts — agents decide what to do with them.

## CI

```yaml
# GitHub Actions
- uses: driftdev/drift@v1
  with:
    min-coverage: 80
```

```bash
# Or run directly
drift scan --min 80

# Compose primitives
drift coverage --min 80
drift lint
drift examples
```

## Philosophy

- Two surfaces, one engine — composed commands for humans, primitives for agents
- Every primitive is individually addressable — `scan` is a convenience, not a gate
- Primitives output structured facts with location data for efficient agent fixes

## Architecture

```
Layer 0: @openpkg-ts/spec   (open standard)
Layer 1: @driftdev/sdk       (detection engine)
Layer 2: drift CLI           (21 commands — composed + primitives + plumbing)
```

## License

MIT
