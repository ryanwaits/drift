---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

Bump `@openpkg-ts/sdk` and `@openpkg-ts/spec` to ^0.54.9. Same-named types in one package get their own ids (`react.Options`), so a parameter no longer resolves to an unrelated namesake (valtio `devtools` options); expression default exports are extracted; const classes carry construct signatures, and a class merged with an interface carries its members.
