---
'@driftdev/cli': minor
'@driftdev/sdk': minor
---

Opinionated four-path CLI. One checker. No shims.

- `drift` is the only check (coverage + lint + prose + key coverage). `--min` is coverage. Findings fail. No health score.
- `drift docs init|propose|baseline` replaces `docs-map`. Auto-loads `drift.docs.json`. `--map` overrides. Propose still opt-in Jev, never scan.
- Deleted: ci, health, coverage, lint, examples, release, report, context, cache, filter, validate, commands, config, init, semver, changelog, diff, breaking.
- Action runs `drift`. Dropped docs-pr, docs-issue, release-gate, release-changelog, validate-examples.
- MCP: extract, list, get, scan. One skill: `/drift`.
- Bump `@openpkg-ts/sdk` `^0.52.2` and `@openpkg-ts/spec` `^0.52.0`.
