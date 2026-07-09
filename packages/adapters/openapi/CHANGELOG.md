# @driftdev/openapi-adapter

## 1.0.1

### Patch Changes

- 27474da: Readable type labels for OpenAPI surfaces. The adapter preserves inlined schema names as `title` (so a resolved `$ref` still knows it was `CandidateInfoSuccessResponse`); `drift get` renders composed types (`string | null`, `Success | Error`) instead of bare `anyOf`/`oneOf`, and long parameter names no longer collide with the type column.

## 1.0.0

### Major Changes

- 215bede: OpenAPI adapter: map OpenAPI 3.0/3.1 documents to ApiSpec and scan REST API surfaces with `drift scan --lang openapi --spec <file>`. Operations become exports (operationId or `METHOD path`), requestBody object schemas flatten into named parameters, local $refs resolve (cycle-safe), success responses carry through — including RPC-style oneOf [success, error] shapes. Named component schemas map to ApiSpec types.
