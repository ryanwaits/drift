---
"@driftdev/sdk": minor
---

Define drift-spec: language-agnostic input types (ApiSpec, ApiExport, ApiTag, etc.) and migrate all drift analysis to use them. openpkg-ts becomes one adapter via toApiSpec() converter. Exports new types from `@driftdev/sdk/types` for external adapter authors.
