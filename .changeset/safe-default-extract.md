---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

Default `new Drift()` no longer sets OpenPkg `followExternal: true` when node_modules exists. That mode expands every dependency (zod's type graph OOMs on this repo's SDK entry). Default now matches CLI extract / `drift page`. Bump `@openpkg-ts/sdk` to ^0.54.3 so explicit `resolveExternalTypes: true` is bounded.
