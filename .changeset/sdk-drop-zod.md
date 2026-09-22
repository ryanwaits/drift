---
"@driftdev/sdk": minor
"@driftdev/cli": patch
---

The SDK no longer depends on `zod`. `drift.config.json` is validated by a small hand-written checker with the same accepted shape. `driftConfigSchema` is kept as a plain `{ parse(input) }` object (no longer a zod schema; `parse` throws a plain `Error` naming the bad path) and `parseDriftConfig` is exported alongside it; `normalizeConfig` is unchanged. Consumers that only build page documents no longer load zod at startup.
