---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

PageDocument accuracy: `spec-not-in-claims` only for mapped types or headings that name the type/member; private/`_` and docs-map `internal` keys are never gaps; instance calls on `new Type()` count as mentioned; gap locator is the type heading. `prose-unresolved-member` only for package-typed receivers. `headingText` is the written heading. TypeScript `meta.name` comes from the nearest package.json. Locator paths are repo-relative.
