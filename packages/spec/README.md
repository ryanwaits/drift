# @openpkg-ts/spec

OpenPkg specification types, validation, normalization, and diffing utilities.

## Install

```bash
npm install @openpkg-ts/spec
```

## Quick Start

```typescript
import { validateSpec, normalize, diffSpec } from '@openpkg-ts/spec';

// Validate a spec
const result = validateSpec(spec);
if (!result.ok) {
  console.error(result.errors);
}

// Normalize for consistent structure
const normalized = normalize(spec);

// Diff two specs
const diff = diffSpec(oldSpec, newSpec);
console.log(`Breaking changes: ${diff.breaking.length}`);
```

## Validation

```typescript
import { validateSpec, assertSpec, getValidationErrors } from '@openpkg-ts/spec';

// Returns { ok: boolean, errors?: ValidationError[] }
const result = validateSpec(spec);

// Throws on invalid
assertSpec(spec);

// Get errors only
const errors = getValidationErrors(spec);
```

## Normalization

Ensures consistent structure and defaults.

```typescript
import { normalize } from '@openpkg-ts/spec';

const normalized = normalize(spec);
// - Sorts exports alphabetically
// - Ensures meta fields exist
// - Normalizes type references
```

## Diffing

Compare specs and detect breaking changes.

```typescript
import { diffSpec, recommendSemverBump, calculateNextVersion } from '@openpkg-ts/spec';

const diff = diffSpec(baseSpec, headSpec);

console.log(`Added: ${diff.added.length}`);
console.log(`Removed: ${diff.removed.length}`);
console.log(`Modified: ${diff.modified.length}`);
console.log(`Breaking: ${diff.breaking.length}`);

// Get semver recommendation
const recommendation = recommendSemverBump(diff);
console.log(`Suggested bump: ${recommendation.bump}`); // 'major' | 'minor' | 'patch'
console.log(`Reason: ${recommendation.reason}`);

// Calculate next version
const next = calculateNextVersion('1.2.3', recommendation.bump);
console.log(`Next version: ${next}`); // '2.0.0'
```

## Dereferencing

Resolve `$ref` pointers in the spec.

```typescript
import { dereference } from '@openpkg-ts/spec';

const dereferenced = dereference(spec);
// All $ref pointers are resolved inline
```

## Types

```typescript
import type {
  OpenPkg,
  SpecExport,
  SpecType,
  SpecFunction,
  SpecClass,
  SpecInterface,
  SpecMeta,
} from '@openpkg-ts/spec';
```

## Exports

### Validation
- `validateSpec(spec)` - Validate against schema
- `assertSpec(spec)` - Throw on invalid
- `getValidationErrors(spec)` - Get errors array
- `getAvailableVersions()` - List schema versions

### Transformation
- `normalize(spec)` - Normalize structure
- `dereference(spec)` - Resolve $ref pointers

### Diffing
- `diffSpec(base, head)` - Compare specs
- `recommendSemverBump(diff)` - Suggest version bump
- `calculateNextVersion(version, bump)` - Calculate next version
- `categorizeBreakingChanges(diff)` - Group by severity

### Types
- `OpenPkg` - Root spec type
- `SpecExport` - Export definition
- `SpecType` - Type definition
- `SpecFunction`, `SpecClass`, `SpecInterface` - Export kinds
- `SpecDiff` - Diff result type

## License

MIT
