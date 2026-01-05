# Two-Spec Architecture

DocCov uses a composition pattern with two separate specifications:

## OpenPkg Spec (`@openpkg-ts/spec`)

The **OpenPkg spec** is a general-purpose TypeScript API specification format. It captures:

- Package metadata (name, version, description)
- Exports with full type information
- Signatures, parameters, return types
- JSDoc comments, examples, tags
- Type definitions and references

This spec is **framework-agnostic** and can be used by any tool that needs to understand a TypeScript package's public API.

```typescript
import type { OpenPkg } from '@openpkg-ts/spec';

const spec: OpenPkg = {
  openpkg: '1.0.0',
  meta: { name: 'my-pkg', version: '1.0.0' },
  exports: [
    {
      name: 'myFunction',
      kind: 'function',
      description: 'Does something',
      signatures: [{ parameters: [...], returns: {...} }],
      examples: [{ code: '...' }]
    }
  ]
};
```

## DocCov Spec (`@doccov/spec`)

The **DocCov spec** extends OpenPkg with coverage and quality analysis. It references an OpenPkg spec and adds:

- **Coverage scores** (0-100 per export)
- **Missing documentation rules** (description, params, returns, examples, throws)
- **Drift detection** (signature mismatches, example errors, broken links)
- **Health metrics** (completeness + accuracy combined)
- **API surface analysis** (forgotten exports)

```typescript
import type { DocCovSpec } from '@doccov/spec';

const doccov: DocCovSpec = {
  doccov: '1.0.0',
  source: {
    file: './openpkg.json',
    specVersion: '1.0.0',
    packageName: 'my-pkg'
  },
  summary: {
    score: 85,
    health: {
      score: 82,
      completeness: { score: 85, documented: 17, total: 20, missing: {...} },
      accuracy: { score: 79, issues: 3, fixable: 2, byCategory: {...} }
    }
  },
  exports: {
    'myFunction': {
      coverageScore: 90,
      missing: ['examples'],
      drift: [{ type: 'param-mismatch', issue: '...', fixable: true }]
    }
  }
};
```

## Composition Pattern

The `buildDocCovSpec()` function in `@doccov/sdk` takes an OpenPkg spec and produces a DocCov spec:

```
OpenPkg Spec → buildDocCovSpec() → DocCov Spec
     ↑                                    ↓
  extract                            coverage analysis
  (typescript-to-spec)               drift detection
                                     health scoring
```

This separation provides:

1. **Reusability**: OpenPkg can power doc generators, IDE plugins, API explorers
2. **Single responsibility**: OpenPkg = "what is the API?", DocCov = "how well is it documented?"
3. **Incremental adoption**: Use OpenPkg without DocCov's opinionated scoring

## Drift Categories

DocCov categorizes drift into three buckets:

| Category | Description | Examples |
|----------|-------------|----------|
| `structural` | Signature mismatches | param-mismatch, return-type-mismatch |
| `semantic` | Metadata issues | deprecated-mismatch, visibility-mismatch |
| `example` | Example problems | example-syntax-error, example-runtime-error |

## Health Score Formula

```
health = (completeness * 0.6) + (accuracy * 0.4)
```

Where:
- **completeness**: Weighted average of export coverage scores
- **accuracy**: 100 - (drift penalty), where each drift issue deducts points
