# @driftdev/sdk

Programmatic API for documentation coverage analysis, drift detection, and spec generation.

## Who This Package Is For

- Teams building custom documentation quality automation.
- Platform/DX engineers integrating Drift into internal tooling.
- Services that need programmatic drift analysis, not just CLI output.

## Why Use It

- Build bespoke workflows (reporting, gating, docs sync) with one engine.
- Access lower-level primitives for analysis, diffing, and validation.
- Keep behavior consistent between local tools and CI services.

## Install

```bash
bun add @driftdev/sdk
```

## Quick Start

```typescript
import { Drift, buildDriftSpec } from '@driftdev/sdk';

// Analyze a package
const drift = new Drift();
const result = await drift.analyzeFileWithDiagnostics('src/index.ts');

// Build coverage spec
const spec = buildDriftSpec({
  openpkg: result.spec,
  openpkgPath: 'src/index.ts',
  packagePath: process.cwd(),
});

console.log(`Coverage: ${spec.summary.score}%`);
console.log(`Drift issues: ${spec.summary.drift.total}`);
```

## Core API

### Drift Detection

15 drift types across 4 categories: structural, semantic, example, prose.

```typescript
import { computeDrift, buildExportRegistry, detectProseDrift, discoverMarkdownFiles } from '@driftdev/sdk';

// JSDoc drift (param mismatches, type errors, broken links, etc.)
const drift = computeDrift(spec);
for (const [exportName, issues] of drift.exports) {
  for (const issue of issues) {
    console.log(`${exportName}: ${issue.issue}`);
    console.log(`  file: ${issue.filePath}:${issue.line}`);
  }
}

// Prose drift (markdown docs referencing non-existent exports)
const registry = buildExportRegistry(spec);
const markdownFiles = discoverMarkdownFiles(process.cwd());
const proseIssues = detectProseDrift({ packageName: '@my/pkg', markdownFiles, registry });
```

Every `SpecDocDrift` includes `filePath` and `line` for agent-driven fixes.

### Coverage Analysis

```typescript
import { buildDriftSpec, getExportDrift } from '@driftdev/sdk';

const driftSpec = buildDriftSpec({ openpkg, openpkgPath, packagePath });

// Get drift for specific export
const drifts = getExportDrift(someExport, driftSpec);
```

### Health Scoring

```typescript
import { computeHealth, isExportDocumented } from '@driftdev/sdk';

const health = computeHealth({
  coverageScore: 88,
  documentedExports: 243,
  totalExports: 275,
  driftIssues: 36,
  fixableDrift: 20,
  driftByCategory: { structural: 20, semantic: 10, example: 5, prose: 1 },
});
```

### Markdown Discovery

```typescript
import { discoverMarkdownFiles, parseMarkdownFiles, findExportReferences } from '@driftdev/sdk';

// Auto-discover markdown files (README.md, docs/**/*.md)
const files = discoverMarkdownFiles(process.cwd(), {
  include: ['README.md', 'docs/**/*.md'],
  exclude: ['node_modules/**'],
});

// Find export references in markdown
const refs = findExportReferences(files, ['createUser', 'updateUser']);
```

### Example Validation

```typescript
import { validateExamples, typecheckExamples } from '@driftdev/sdk';

// Full validation (presence + typecheck + run)
const validation = await validateExamples(spec, {
  validations: ['presence', 'typecheck', 'run'],
  targetDir: process.cwd(),
});
```

### Target Resolution

```typescript
import { resolveTarget, NodeFileSystem } from '@driftdev/sdk';

const fs = new NodeFileSystem(process.cwd());
const { entryFile, targetDir, packageInfo } = await resolveTarget(fs, {
  cwd: process.cwd(),
});
```

### History & Trends

```typescript
import { saveSnapshot, loadSnapshots, getTrend, computeSnapshot } from '@driftdev/sdk/history';

saveSnapshot(computeSnapshot(spec), process.cwd());
const snapshots = loadSnapshots(process.cwd());
const trend = getTrend(spec, process.cwd());
```

### Categorize & Summarize

```typescript
import { categorizeDrift, getDriftSummary, groupDriftsByCategory } from '@driftdev/sdk/analysis';

const summary = getDriftSummary(drifts);
// summary.total, summary.byCategory (structural/semantic/example/prose)

const grouped = groupDriftsByCategory(drifts);
// grouped.structural[], grouped.semantic[], grouped.example[], grouped.prose[]
```

## Exports

### Analysis
- `Drift` — Main analysis class
- `buildDriftSpec` — Build coverage spec
- `computeDrift` / `computeExportDrift` — Drift detection
- `computeHealth` — Health score computation
- `generateReport` — Generate coverage reports

### Drift Detection
- `detectProseDrift` — Markdown prose drift detection
- `buildExportRegistry` — Build registry for cross-reference validation
- `categorizeDrift` / `getDriftSummary` / `groupDriftsByCategory` — Categorization (via `@driftdev/sdk/analysis`)

### Markdown
- `discoverMarkdownFiles` — Auto-discover markdown files by glob patterns
- `parseMarkdownFiles` — Parse markdown for code blocks
- `findExportReferences` — Find export references in markdown
- `diffSpecWithDocs` — Diff specs with doc impact analysis

### Examples
- `validateExamples` — Full example validation
- `typecheckExamples` — Type-check examples

### Resolution
- `resolveTarget` — Resolve entry points
- `NodeFileSystem` — File system adapter
- `detectPackageManager` — Detect npm/yarn/pnpm/bun

### History (via `@driftdev/sdk/history`)
- `saveSnapshot` / `loadSnapshots` — Manage coverage history
- `getTrend` / `getExtendedTrend` — Trend analysis
- `pruneHistory` — Clean old snapshots

### Configuration
- `normalizeConfig` — Config normalization
- `driftConfigSchema` — Zod schema for validation

## License

MIT
