---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

Bump `@openpkg-ts/sdk` to ^0.54.7. A tsconfig that sets `module` without `moduleResolution` no longer breaks relative imports during extraction, so exports typed through them stop coming out as `any` (immer's bound methods such as `setAutoFreeze` now have signatures). Spec stays ^0.54.4.
