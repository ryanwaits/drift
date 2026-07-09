---
"@driftdev/openapi-adapter": major
"@driftdev/cli": minor
---

OpenAPI adapter: map OpenAPI 3.0/3.1 documents to ApiSpec and scan REST API surfaces with `drift scan --lang openapi --spec <file>`. Operations become exports (operationId or `METHOD path`), requestBody object schemas flatten into named parameters, local $refs resolve (cycle-safe), success responses carry through — including RPC-style oneOf [success, error] shapes. Named component schemas map to ApiSpec types.
