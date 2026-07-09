---
"@driftdev/sdk": minor
"@driftdev/cli": minor
"@driftdev/clarity-adapter": patch
---

Publish integrity + audit fixes. CLI: replace `workspace:*` internal dep ranges with real semver (1.3.0 was uninstallable via npm — the workspace protocol leaked into the published manifest), drop dead main/types/exports fields (bin-only package), correct `--help` claims. SDK: ship `schemas/` so `SCHEMA_URL` stops 404ing, remove orphaned scan/install modules, move type-only @vercel/sandbox out of runtime deps. All packages: `engines.node >=20`, `prepublishOnly` build guard; clarity adapter now ships LICENSE + README.
