# @driftdev/clarity-adapter

Maps Clarity smart contracts (ABI + doc comments) to Drift's `ApiSpec` so contracts run through the same docs-drift analysis as TypeScript packages.

## Usage

### CLI

```bash
drift scan --lang clarity --abi token.abi.json token.clar
```

### SDK

```ts
import { fromSource, toApiSpec } from '@driftdev/clarity-adapter';
import { computeDrift } from '@driftdev/sdk/analysis';

// Convenience: parse doc comments from source + map ABI in one call
const spec = fromSource(clarSource, abi, { name: 'token' });

// Lower-level: bring your own parsed docs
// const spec = toApiSpec(abi, docs, { name: 'token' });

const result = computeDrift(spec);
```

- `fromSource(source, abi, meta)` — parses `;; @desc/@param/...` doc comments and maps the ABI → `ApiSpec`
- `toApiSpec(abi, docs, meta)` — maps `ClarityContract` + `ContractDoc` → `ApiSpec`
- `clarityTypeToSchema(type)` — maps a Clarity type to an `ApiSchema`

Functions, maps, variables, constants, tokens, and traits become exports; doc coverage and drift detection work unchanged.

## License

MIT
