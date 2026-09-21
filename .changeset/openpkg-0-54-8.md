---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

Bump `@openpkg-ts/sdk` and `@openpkg-ts/spec` to ^0.54.8. A value and an interface under one name carry the interface's members (zod: 80 of 81 schema classes now have `parse`, `optional`, `email`...), exports bound by destructuring are kept (SWR `mutate`, `unload`), an annotated const function takes its signature from the annotation, rest parameters are `rest: true` and never required, default exports carry `localName`, and a tsconfig that sets `module` alone resolves imports on TypeScript 5 as well as 6.
