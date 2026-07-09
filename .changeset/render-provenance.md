---
"@driftdev/openapi-adapter": patch
"@driftdev/cli": patch
---

Readable type labels for OpenAPI surfaces. The adapter preserves inlined schema names as `title` (so a resolved `$ref` still knows it was `CandidateInfoSuccessResponse`); `drift get` renders composed types (`string | null`, `Success | Error`) instead of bare `anyOf`/`oneOf`, and long parameter names no longer collide with the type column.
