---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

PageDocument: prose candidates, heading/cross-fence gap mentions, fence call-site rules.

- Emit `kind: 'prose'` candidates for sentences, list items, and table cells that name an export or `Type.member`. Bare-word match only for camelCase, PascalCase with 2+ humps, or names with digits/underscores; dictionary-plain names (`Room`, `atom`) still need backticks. No rule, so scan/CI unchanged.
- `spec-not-in-claims`: `new Type()` bindings persist across fences; under a heading that names type T, a backticked `member` or `member(...)` counts as `T.member`.
- New PageDocument fence rules (not scan): `prose-unknown-key`, `prose-arity-mismatch`, `prose-missing-required`. Type arguments are not arguments. Unknown receiver = no claim.
