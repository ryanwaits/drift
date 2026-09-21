---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

Bump `@openpkg-ts/sdk` to ^0.54.10. Schema expansion is budgeted per export, so large packages no longer degrade by export order (zod: 27% -> 100% of exports with full schemas; valibot 64% -> 100%). An interface or class records `extends` even when the base is unresolved, and its shape stays open; generic aliases written in a signature (`StateCreator<...>`) stay as written refs; type parameters are never type refs; an `export { X }` of an imported binding resolves. Spec stays ^0.54.9.
