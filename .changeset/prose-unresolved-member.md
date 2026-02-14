---
"@driftdev/sdk": minor
---

Add `prose-unresolved-member` drift detection — validates method/property calls in doc code blocks against exported type members. Includes five-layer false positive filtering: known exports, external imports, package-derived objects, JS built-in methods, and type member lookup.
