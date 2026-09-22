In all interactions, plans, and commit messages, be extremely concise and sacrifice grammar for the sake of concision.

Always use bun.

## Dependency policy

- Never use dist-tags (`"latest"`) as version ranges; always a real range or pin.
- Published packages (sdk, cli, adapters): caret ranges for runtime deps; exact pins for build tooling (bunup, @biomejs/biome).
- Internal deps between published packages: real semver ranges (`^1.0.0`), never `workspace:*` — npm publish leaks the workspace protocol verbatim and the package becomes uninstallable (happened to @driftdev/cli@1.3.0).
- Apps (apps/site): exact pins for framework deps (next, react, lucide-react); bump via explicit change verified by `bun run build:site`.
- typescript stays on ^5: runtime dep of the extraction pipeline (@openpkg-ts/sdk compiler API); TS 7 needs a dedicated migration.
- @openpkg-ts/sdk + @openpkg-ts/spec move together, currently ^0.54.11 / ^0.54.9 (sdk 0.54.11 depends on spec ^0.54.9); both track latest minor (0.x caret = locked minor, so upstream releases require an explicit bump + drift release).
- packages/sdk has no zod dependency; drift.config is validated by a hand-written checker (src/config/schema.ts). Keep it that way — consumers must not load zod to build page documents. (cli still uses zod for MCP tool schemas.)
- Runtime major bumps: TRIAGE.md writeup + changelog read before landing; never casually.
