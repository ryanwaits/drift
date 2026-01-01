# Analysis

The DocCov class provides TypeScript API surface extraction and documentation analysis.

## DocCov Class

```typescript
import { DocCov } from '@doccov/sdk';

const doccov = new DocCov(options);
```

### Constructor Options

```typescript
interface DocCovOptions {
  includePrivate?: boolean;        // Include private exports (default: false)
  followImports?: boolean;         // Follow imports (default: true)
  maxDepth?: number;               // Type recursion depth (default: 20)
  resolveExternalTypes?: boolean;  // Resolve node_modules types
  useCache?: boolean;              // Enable caching (default: true)
  cwd?: string;                    // Working directory
}
```

### Methods

#### analyzeFileWithDiagnostics

Full analysis with metadata and diagnostics.

```typescript
const result = await doccov.analyzeFileWithDiagnostics(
  'src/index.ts',
  { filters: { include: ['MyClass'] } }
);

// result.spec: OpenPkg
// result.diagnostics: Diagnostic[]
// result.metadata: AnalysisMetadata
// result.fromCache: boolean
```

#### analyzeFile

Simple analysis returning just the spec.

```typescript
const spec = await doccov.analyzeFile('src/index.ts');
```

#### analyze

Analyze code string (for testing).

```typescript
const spec = await doccov.analyze(`
  export function hello(name: string): string {
    return \`Hello \${name}\`;
  }
`);
```

## Analysis Options

```typescript
interface AnalyzeOptions {
  filters?: FilterOptions;
  generationInput?: GenerationInput;
}

interface FilterOptions {
  include?: string[];    // ['MyClass', 'use*']
  exclude?: string[];    // ['*Internal']
  visibility?: ReleaseTag[];  // ['public', 'beta']
}

type ReleaseTag = 'public' | 'beta' | 'alpha' | 'internal';
```

## Analysis Result

```typescript
interface AnalysisResult {
  spec: OpenPkg;
  diagnostics: Diagnostic[];
  metadata: AnalysisMetadata;
  fromCache?: boolean;
  cacheStatus?: CacheValidationResult;
}

interface Diagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  location?: { file: string; line?: number };
}
```

## Enrichment

Add coverage metadata to spec:

```typescript
import { enrichSpec } from '@doccov/sdk';

const enriched = await enrichSpec(spec, {
  qualityConfig: {
    rules: { 'has-description': 'error' }
  }
});

// enriched.docs.coverageScore: number
// enriched.exports[].docs.coverageScore: number
// enriched.exports[].docs.drift: SpecDocDrift[]
// enriched.driftSummary: DriftSummary
```

### EnrichOptions

```typescript
interface EnrichOptions {
  driftByExport?: Map<string, SpecDocDrift[]>;
  qualityConfig?: QualityConfig;
  rawJSDocByExport?: Map<string, string>;
}
```

## Report Generation

```typescript
import { generateReport, generateReportFromDocCov, buildDocCovSpec } from '@doccov/sdk';

// From raw spec
const report = generateReport(spec);

// From OpenPkg + DocCov specs (composition pattern)
const doccov = buildDocCovSpec({ openpkg, openpkgPath: 'openpkg.json' });
const report = generateReportFromDocCov(openpkg, doccov);
```

### Report Structure

```typescript
interface DocCovReport {
  $schema: string;
  version: string;
  generatedAt: string;
  spec: { name: string; version: string };
  coverage: CoverageSummary;
  exports: Record<string, ExportCoverageData>;
}

interface CoverageSummary {
  score: number;            // 0-100
  totalExports: number;
  documentedExports: number;
  missingByRule: Record<string, number>;
  driftCount: number;
  driftSummary?: DriftSummary;
}
```

## Caching

Specs are cached in `.doccov/.spec-cache.json` with hash-based invalidation:

```typescript
// Force fresh analysis
const doccov = new DocCov({ useCache: false });

// Clear cache manually
import { clearSpecCache } from '@doccov/sdk';
clearSpecCache(process.cwd());
```

Cache invalidates on:
- Source file changes
- tsconfig.json changes
- package.json changes
- Config changes

## Pipeline

1. **Parse** - TypeScript compiler API creates AST
2. **Extract** - Walk exports, signatures, types
3. **Serialize** - Convert to JSON Schema format
4. **Filter** - Apply include/exclude patterns
5. **Enrich** - Add coverage scores, drift
6. **Report** - Generate summary statistics
