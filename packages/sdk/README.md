# @doccov/sdk

Programmatic API for documentation coverage analysis, drift detection, and spec generation.

## Install

```bash
npm install @doccov/sdk
```

## Quick Start

```typescript
import { DocCov, buildDocCovSpec } from '@doccov/sdk';

// Analyze a package
const doccov = new DocCov();
const result = await doccov.analyzeFileWithDiagnostics('src/index.ts');

// Build coverage spec
const spec = buildDocCovSpec({
  openpkg: result.spec,
  openpkgPath: 'src/index.ts',
  packagePath: process.cwd(),
});

console.log(`Coverage: ${spec.summary.score}%`);
console.log(`Drift issues: ${spec.summary.drift.total}`);
```

## Core API

### DocCov Class

Main analysis engine.

```typescript
import { DocCov } from '@doccov/sdk';

const doccov = new DocCov({
  resolveExternalTypes: true,
  maxDepth: 20,
  useCache: true,
});

const { spec, diagnostics } = await doccov.analyzeFileWithDiagnostics(
  'src/index.ts',
  { filters: { visibility: ['public', 'beta'] } }
);
```

### Coverage Analysis

```typescript
import { buildDocCovSpec, getExportDrift } from '@doccov/sdk';

// Build DocCov spec with coverage data
const doccovSpec = buildDocCovSpec({ openpkg, openpkgPath, packagePath });

// Get drift for specific export
const drifts = getExportDrift(someExport, doccovSpec);
```

### Example Validation

```typescript
import { runExamples, typecheckExamples, validateExamples } from '@doccov/sdk';

// Run @example blocks
const results = await runExamples(spec.exports, { cwd: process.cwd() });

// Typecheck examples
const typeErrors = await typecheckExamples(spec.exports, { cwd: process.cwd() });

// Full validation
const validation = await validateExamples(spec, {
  validations: ['presence', 'typecheck', 'run'],
  targetDir: process.cwd(),
});
```

### Target Resolution

```typescript
import { resolveTarget, NodeFileSystem } from '@doccov/sdk';

const fs = new NodeFileSystem(process.cwd());
const { entryFile, targetDir, packageInfo } = await resolveTarget(fs, {
  cwd: process.cwd(),
  package: '@my/package', // For monorepos
});
```

### History & Trends

```typescript
import { saveSnapshot, loadSnapshots, getTrend } from '@doccov/sdk';

// Save coverage snapshot
saveSnapshot(computeSnapshot(spec), process.cwd());

// Load history
const snapshots = loadSnapshots(process.cwd());

// Get trend analysis
const trend = getTrend(spec, process.cwd());
console.log(`Delta: ${trend.delta}%`);
```

## Exports

### Analysis
- `DocCov` - Main analysis class
- `buildDocCovSpec` - Build coverage spec
- `getExportDrift` - Get drift for an export
- `generateReport` - Generate coverage reports

### Examples
- `runExamples` / `runExample` - Execute @example blocks
- `typecheckExamples` - Type-check examples
- `validateExamples` - Full example validation

### Resolution
- `resolveTarget` - Resolve entry points
- `NodeFileSystem` - File system adapter
- `detectPackageManager` - Detect npm/yarn/pnpm/bun

### History
- `saveSnapshot` / `loadSnapshots` - Manage coverage history
- `getTrend` / `getExtendedTrend` - Trend analysis
- `pruneHistory` - Clean old snapshots

### Utilities
- `diffSpecWithDocs` - Diff specs with doc impact
- `parseMarkdownFiles` - Parse markdown for refs
- `generateFix` / `applyPatchToJSDoc` - Auto-fix drift

## License

MIT
