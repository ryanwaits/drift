# @openpkg-ts/extract

TypeScript API extraction library. Generates OpenPkg specs from TypeScript source code.

## Install

```bash
npm install @openpkg-ts/extract
```

## CLI Usage

```bash
# Extract API spec from entry point
tspec src/index.ts -o openpkg.json

# With options
tspec src/index.ts --max-depth 4 --verbose
```

## Programmatic Usage

```typescript
import { extract } from '@openpkg-ts/extract';

const result = await extract({
  entryFile: 'src/index.ts',
  maxTypeDepth: 4,
  resolveExternalTypes: true,
});

console.log(`Extracted ${result.spec.exports.length} exports`);
console.log(`Found ${result.spec.types?.length ?? 0} types`);

// Check for diagnostics
for (const diag of result.diagnostics) {
  console.warn(`${diag.severity}: ${diag.message}`);
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entryFile` | `string` | required | Entry point file path |
| `baseDir` | `string` | cwd | Base directory for resolution |
| `maxTypeDepth` | `number` | 4 | Max depth for type traversal |
| `resolveExternalTypes` | `boolean` | true | Resolve types from node_modules |
| `schemaExtraction` | `'static' \| 'hybrid'` | 'static' | Schema extraction mode |

## Exports

### Core
- `extract(options)` - Main extraction function

### AST Utilities
- `getModuleExports` - Get exports from a module
- `resolveExportTarget` - Resolve re-exports to source

### Type Utilities
- `TypeRegistry` - Track and dedupe extracted types
- `serializeType` - Convert TS types to schema

### Schema Adapters
- `ZodAdapter`, `ValibotAdapter` - Runtime schema extraction

## How It Works

1. Creates a TypeScript program from the entry file
2. Extracts all exported symbols
3. Serializes each export (functions, classes, types, variables)
4. Resolves type references and builds a type registry
5. Outputs an OpenPkg-compliant JSON spec

## License

MIT
