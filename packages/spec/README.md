# @openpkg-ts/spec

OpenPkg schema, types, validation, and diffing utilities.

## Install

```bash
npm install @openpkg-ts/spec
```

## Usage

```typescript
import { validateSpec, normalize, diffSpec } from '@openpkg-ts/spec';

// Validate
const result = validateSpec(normalize(spec));
if (!result.ok) {
  console.error(result.errors);
}

// Diff two specs
const diff = diffSpec(oldSpec, newSpec);
console.log(`Coverage delta: ${diff.coverageDelta}%`);
```

## Exports

- `validateSpec` / `assertSpec` / `getValidationErrors` - Schema validation
- `getAvailableVersions` - List supported schema versions
- `normalize` - Ensure consistent structure
- `dereference` - Resolve `$ref` pointers
- `diffSpec` - Compare specs

## Documentation

- [Spec Overview](../../docs/spec/overview.md)
- [Types Reference](../../docs/spec/types.md)
- [Drift Types](../../docs/spec/drift-types.md)
- [Diffing](../../docs/spec/diffing.md)

## License

MIT
