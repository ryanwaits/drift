# SDK

Package: `@driftdev/sdk`. Use it to integrate drift analysis into your own tools programmatically.

## Install

```bash
bun add @driftdev/sdk
```

## Core API

### `Drift` -- Spec Extraction

Extract a typed API spec from a TypeScript entry point:

```typescript
import { Drift } from '@driftdev/sdk';

const drift = new Drift({
  resolveExternalTypes: true,
  maxDepth: 10,
});

const result = await drift.analyzeFileWithDiagnostics('src/index.ts');
const spec = result.spec;

console.log(`${spec.exports.length} exports found`);
```

Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `resolveExternalTypes` | `boolean` | `true` | Resolve types from dependencies |
| `maxDepth` | `number` | `10` | Max depth for type resolution |
| `useCache` | `boolean` | `true` | Use spec cache |

### `computeDrift` -- Drift Detection

Cross-reference JSDoc against code signatures:

```typescript
import { Drift, computeDrift } from '@driftdev/sdk';

const drift = new Drift();
const { spec } = await drift.analyzeFileWithDiagnostics('src/index.ts');

const result = computeDrift(spec);

for (const [exportName, drifts] of result.exports) {
  for (const drift of drifts) {
    console.log(`${exportName}: ${drift.issue}`);
    // drift.type     -- e.g. 'param-mismatch', 'return-type-mismatch'
    // drift.target   -- affected parameter/property name
    // drift.expected -- what JSDoc says
    // drift.actual   -- what code says
    // drift.filePath -- source file
    // drift.line     -- line number
  }
}
```

The `DriftResult.exports` is a `Map<string, SpecDocDrift[]>`.

### `buildExportRegistry` -- Export Registry

Build a lookup table of all exports for cross-reference validation:

```typescript
import { buildExportRegistry } from '@driftdev/sdk';

const registry = buildExportRegistry(spec);

// Check if an export exists
registry.all.has('parseConfig');      // true/false
registry.exports.has('parseConfig');  // true/false (exports only)
registry.types.has('Config');         // true/false (types only)
```

### `detectProseDrift` -- Markdown Drift

Scan markdown files for broken import references:

```typescript
import { buildExportRegistry, detectProseDrift, discoverMarkdownFiles } from '@driftdev/sdk';

const registry = buildExportRegistry(spec);
const markdownFiles = discoverMarkdownFiles(process.cwd(), {
  include: ['README.md', 'docs/**/*.md'],
  exclude: ['node_modules/**'],
});

const issues = detectProseDrift({
  packageName: '@my-scope/my-lib',
  markdownFiles,
  registry,
});

for (const issue of issues) {
  console.log(`${issue.filePath}:${issue.line} -- ${issue.issue}`);
  if (issue.suggestion) console.log(`  ${issue.suggestion}`);
}
```

### `generateReport` -- Full Report

Generate a coverage report from a spec:

```typescript
import { Drift, generateReport } from '@driftdev/sdk';

const drift = new Drift();
const { spec } = await drift.analyzeFileWithDiagnostics('src/index.ts');
const report = await generateReport(spec);

console.log(`Coverage: ${report.coverage.score}%`);
console.log(`Documented: ${report.coverage.documentedExports}/${report.coverage.totalExports}`);
console.log(`Drift issues: ${report.coverage.driftCount}`);
```

### `validateExamples` -- Example Validation

Validate `@example` blocks for presence, type-correctness, and runtime behavior:

```typescript
import { Drift, validateExamples } from '@driftdev/sdk';

const drift = new Drift();
const { spec } = await drift.analyzeFileWithDiagnostics('src/index.ts');

const result = await validateExamples(spec.exports, {
  validations: ['presence', 'typecheck'],
  packagePath: process.cwd(),
  exportNames: spec.exports.map(e => e.name),
});

console.log(`Examples present: ${result.presence?.withExamples}/${result.presence?.total}`);
if (result.typecheck) {
  console.log(`Typecheck: ${result.typecheck.passed} passed, ${result.typecheck.failed} failed`);
}
```

Validation levels: `'presence'`, `'typecheck'`, `'run'`.

### `isFixableDrift` -- Fix Classification

Check if a drift issue can be auto-fixed:

```typescript
import { computeDrift, isFixableDrift } from '@driftdev/sdk';

const result = computeDrift(spec);
for (const [name, drifts] of result.exports) {
  for (const drift of drifts) {
    if (isFixableDrift(drift)) {
      console.log(`${name}: ${drift.issue} (auto-fixable)`);
    }
  }
}
```

### `computeHealth` -- Health Scoring

Compute the SDK-level health score (more detailed than the CLI's simplified version):

```typescript
import { computeHealth, type HealthInput } from '@driftdev/sdk';

const input: HealthInput = {
  coverageScore: 88,
  documentedExports: 22,
  totalExports: 25,
  missingByRule: { description: 3 },
  driftIssues: 4,
  fixableDrift: 2,
  driftByCategory: { structural: 3, semantic: 1, example: 0, prose: 0 },
};

const health = computeHealth(input);
console.log(`Score: ${health.score}`);
console.log(`Completeness: ${health.completeness.score}`);
console.log(`Accuracy: ${health.accuracy.score}`);
```

## Key Types

```typescript
import type {
  SpecDocDrift,          // A single drift issue
  DriftType,             // 'param-mismatch' | 'return-type-mismatch' | ...
  DriftCategory,         // 'structural' | 'semantic' | 'example' | 'prose'
  DriftResult,           // { exports: Map<string, SpecDocDrift[]> }
  ExportRegistry,        // Lookup table for cross-reference validation
  DriftReport,          // Full coverage report
  CoverageSummary,       // Coverage stats
  HealthInput,           // Input to computeHealth
} from '@driftdev/sdk';
```

## Subpath Imports

The SDK also exposes subpath imports for specialized use:

```typescript
// Analysis utilities
import { generateReport, computeSnapshot } from '@driftdev/sdk/analysis';

// Type definitions
import type { DriftReport, FilterOptions } from '@driftdev/sdk/types';
```

## Constants

```typescript
import { DRIFT_CATEGORIES, DRIFT_CATEGORY_LABELS } from '@driftdev/sdk';

// DRIFT_CATEGORIES maps DriftType -> DriftCategory
// e.g. DRIFT_CATEGORIES['param-mismatch'] === 'structural'

// DRIFT_CATEGORY_LABELS maps DriftCategory -> human label
// e.g. DRIFT_CATEGORY_LABELS['structural'] === 'Signature mismatches'
```
