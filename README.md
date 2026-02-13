# drift

> Your code changed. Your docs didn't.

Core job: fail PRs when docs drift.

Detect documentation drift in TypeScript packages. Drift catches when JSDoc, examples, and markdown fall out of sync with your actual API.

## Quick Start

```bash
# Gate PRs/branches in CI
drift ci --all --min 80

# Full package scan (coverage + lint + prose drift + health)
drift scan

# Triage issues locally
drift lint
```

## Who It Helps

- Teams shipping TypeScript libraries, SDKs, or CLI packages with public exports.
- Maintainers who want CI to catch documentation regressions before merge.
- DX/DevRel teams that need docs accuracy to scale with release velocity.

## Who It Does Not Help

- Apps with no exported TypeScript API surface to document.
- Teams that do not use JSDoc or markdown docs as part of their release workflow.
- Repos that are not ready to enforce docs quality in CI.

## Why It Matters

- Broken docs create support load, failed onboarding, and release risk.
- Drift turns docs quality from a manual checklist into a repeatable CI gate.
- You get machine-readable issues with file/line locations so fixes are fast.

## How To Adopt

1. Run `drift scan` in your package and review issues.
2. Set a baseline threshold: `drift ci --all --min 80`.
3. Add the GitHub Action and enforce the gate on pull requests.

Entry auto-detects from `package.json` metadata (`types`, `exports`, `main`, `module`, `bin`).

Best fit: libraries, SDKs, and CLI packages that publish an exported API surface.

If you only do one thing: run `drift ci --all --min 80` in pull requests and fail when coverage or lint falls below your bar.

## Core 5 Commands

| Command | When To Use It |
|---------|----------------|
| `drift ci --all --min 80` | Fail pull requests when docs quality drops |
| `drift scan` | Run a full docs audit locally before opening a PR |
| `drift lint` | Find signature/JSDoc mismatches with file and line data |
| `drift coverage --min 80` | Enforce a documentation coverage floor |
| `drift list --undocumented` | Build a backlog of missing docs work |

Need full command/flag details? See `docs/cli-reference.md` or run `drift --capabilities`.

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

drift ships as a [Claude Code skill](https://docs.anthropic.com/en/docs/claude-code). Install the skill, then use `/drift` inside any TypeScript package:

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
- uses: ryanwaits/drift/action@v1
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

## Pricing & Packaging

- CLI (`@driftdev/cli`): MIT, free
- Spec (`@driftdev/spec`): MIT, free
- SDK (`@driftdev/sdk`): BUSL-1.1 (source-available)
- Hosted plans: org reporting + docs sync automation
- Join Cloud Pro waitlist: https://github.com/ryanwaits/drift/issues/new?title=Cloud%20Pro%20Waitlist
- Request Automation pilot: https://github.com/ryanwaits/drift/issues/new?title=Automation%20Pilot%20Request
- Enterprise contact: https://github.com/ryanwaits/drift/issues/new?title=Enterprise%20Inquiry

See `docs/pricing-packaging.md` for the one-page packaging proposal.

## Choose A Guide

- New to Drift: `docs/getting-started.md`
- Setting CI gates: `docs/ci-integration.md`
- Configuring thresholds and discovery: `docs/configuration.md`
- Building custom tooling: `docs/sdk.md`
- Full map by role: `docs/guide-map.md`

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

Dual license by package:

- `@driftdev/cli`: MIT
- `@driftdev/spec`: MIT
- `@driftdev/sdk`: BUSL-1.1
