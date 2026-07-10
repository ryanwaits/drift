# drift

> Your code changed. Your docs didn't.

Detect when your docs drift from your code. TypeScript packages, REST APIs (OpenAPI), Clarity contracts — Drift extracts what your API actually is and finds every doc that's now wrong.

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
- API teams whose hand-written guides must stay true to their OpenAPI spec.
- Maintainers who want CI to catch documentation regressions before merge.
- DX/DevRel teams that need docs accuracy to scale with release velocity.

## Who It Does Not Help

- Apps with no API surface to document (no exports, no spec, no contract).
- Teams whose docs are not part of their release workflow.
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

Need full command/flag details? See `docs/cli-reference.md` or run `drift --tools`.

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

Detection is the tool's job. Mutation and judgment are the agent's job. Deterministic edges, LLM in the middle: drift extracts what the API *actually is*; agents verify what the docs *claim*.

**MCP** — expose drift's truth primitives to any agent (Claude Code, Cursor, custom):

```bash
claude mcp add drift -- drift mcp
# tools: drift_extract, drift_list, drift_get, drift_scan, drift_diff, drift_breaking
```

**Skills** — shipped in [`skills/`](skills/), install by copying into `~/.claude/skills/`:

- `/drift` — coverage, validate, fix workflows against any truth source
- `/docs-verify` — audit an entire docs site against the API: agent extracts claims page by page, verifies each with `drift get`, reports phantom/wrong-param/stale findings with file:line

```bash
# Machine-readable command discovery
drift --tools
```

## Drift Detection

17 drift types across 4 categories:

| Category | Types | Description |
|----------|-------|-------------|
| **structural** | 7 | JSDoc types/params don't match code signature |
| **semantic** | 3 | Deprecation, visibility, broken `{@link}` references |
| **example** | 4 | @example code has errors or doesn't work |
| **prose** | 3 | Markdown docs import non-existent exports, call non-existent members, or promote deprecated APIs |

Every drift issue includes `filePath` and `line` for agent-driven fixes.

## How It Works

```
TypeScript source     OpenAPI 3.x document     Clarity contract
    |                     |                        |
    |  openpkg-ts         |  openapi adapter       |  clarity adapter
    v                     v                        v
              ApiSpec  (one portable API structure)
                          |  drift scan / lint / coverage / list / get / diff
                          v
              structured facts  (JSON to stdout, file:line locations)
                          |
                          v
              agents verify docs claims against the facts
```

Truth adapters map any API surface into one spec; analysis runs against it. Every command outputs facts — agents decide what to do with them. Deterministic edges, LLM in the middle.

```bash
drift scan                                    # TypeScript package (entry auto-detected)
drift scan --spec openapi.json                # REST API — path or URL, lang inferred
drift scan --abi token.abi.json token.clar    # Clarity contract
drift get candidateInfo --spec https://developers.ashbyhq.com/openapi/ashby-api.json
```

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
Truth adapters:  @openpkg-ts/sdk (TypeScript) · @driftdev/openapi-adapter · @driftdev/clarity-adapter
Engine:          @driftdev/sdk        (ApiSpec + 17 drift detectors)
Surfaces:        drift CLI (23 commands) · drift mcp (agent tools) · skills/ (agent playbooks)
```

## License

MIT licensed. Free and open source.
