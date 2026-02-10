# drift

> Know when your TypeScript docs lie.

Documentation quality primitives for TypeScript. 19 atomic commands that give AI agents structured understanding of your API.

## Quick Start

```bash
# Full scan: coverage + lint + prose drift + health
drift scan src/index.ts

# Check documentation coverage
drift coverage src/index.ts

# Find JSDoc issues (param mismatches, broken links, type errors)
drift lint src/index.ts

# List all exports
drift list src/index.ts
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
| `drift init` | Create configuration file |
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

## Agent Discovery

```bash
# Machine-readable list of all commands, flags, and types
drift --capabilities
```

Agents call `drift --capabilities` to discover available primitives at runtime. New commands work automatically.

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
.doccov/context.md   (agent-readable project state)
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
# Single command: coverage + lint + prose + health
drift scan --min 80

# Or compose primitives
drift coverage --min 80
drift lint
drift examples
```

## Philosophy

- Two surfaces, one engine — composed commands for humans, primitives for agents
- Every primitive is individually addressable — `scan` is a convenience, not a gate
- No bundled workflows — agents compose primitives via skills
- Primitives output structured facts with location data for efficient agent fixes

## Architecture

```
Layer 0: @openpkg-ts/spec   (open standard)
Layer 1: @doccov/sdk         (detection engine)
Layer 2: drift CLI           (19 commands — composed + primitives + plumbing)
Layer 3: drift skills        (agent workflow instructions)
```

## License

MIT
