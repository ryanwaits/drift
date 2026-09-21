---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

PageDocument: new `prose-param-mismatch` rule checks parameter tables and `## Parameters` lists against the signatures of the export their heading names (exact or silent). Fixes: `buildPageDocuments` forwards `importSpecifier`; an aliased import is checked (and bound at call sites) by its imported name, default imports are never a missing export; `prose-deprecated-reference` is silent when the enclosing section notes the deprecation or names the replacement, and is located on the import; a self-named external type no longer overflows the closed-shape walk.
