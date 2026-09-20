---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

Bump `@openpkg-ts/sdk` to ^0.54.5 and `@openpkg-ts/spec` to ^0.54.4. Extracted specs now tell `undefined` from `null` (`T | undefined` is no longer `T | null`), and a generic return type such as `LiveMap<string, V>` no longer comes out as an empty schema. Re-extract to pick this up; the CLI's spec cache is keyed on the CLI version, so upgrading does that for you.
