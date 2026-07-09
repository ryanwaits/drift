# @driftdev/openapi-adapter

Maps OpenAPI 3.0/3.1 documents to Drift's `ApiSpec` so REST API surfaces run through the same docs-drift analysis as TypeScript packages.

## Usage

### CLI

```bash
drift scan --lang openapi --spec openapi.json
```

### SDK

```ts
import { fromDocument, toApiSpec } from '@driftdev/openapi-adapter';
import { computeDrift } from '@driftdev/sdk/analysis';

const spec = fromDocument(jsonString); // or a parsed document object
const result = computeDrift(spec);
```

- `fromDocument(document, meta?)` — JSON string or parsed object → `ApiSpec`
- `toApiSpec(doc, meta?)` — parsed `OpenApiDocument` → `ApiSpec`
- `resolveRef` / `deepResolve` — local `$ref` resolution helpers

## Mapping

- Each path + method → one export, named by `operationId` (fallback `METHOD /path`)
- `description`/`summary` and `deprecated` carry over
- Path/query/header parameters and JSON `requestBody` object properties → signature parameters (body schemas flatten into named params)
- Lowest 2xx (or `default`) JSON response → return schema — RPC-style `oneOf [success, error]` shapes carry through resolved
- `components/schemas` → `ApiSpec.types`
- `$ref` resolution is local-only and cycle-safe; remote refs pass through untouched

JSON documents only (convert YAML first).

## License

MIT
