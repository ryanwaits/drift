# @openpkg-ts/doc-generator

API documentation generator consuming OpenPkg specs. A modern alternative to TypeDoc for doc frameworks like Fumadocs, Mintlify, and Docusaurus.

## Features

- **Multiple output formats**: Markdown/MDX, HTML, JSON
- **React components**: Headless and pre-styled (Tailwind v4)
- **Search indexes**: Pagefind and Algolia compatible
- **Framework adapters**: Fumadocs, Docusaurus, and generic navigation
- **CLI tooling**: Generate static docs or dev server

## Installation

```bash
npm install @openpkg-ts/doc-generator
# or
bun add @openpkg-ts/doc-generator
```

## Quick Start

### Programmatic API

```ts
import { createDocs } from '@openpkg-ts/doc-generator'

// Load from file or object
const docs = createDocs('./openpkg.json')

// Query exports
docs.getExport('useState')
docs.getExportsByKind('function')
docs.getExportsByTag('@beta')
docs.search('hook')

// Render
docs.toMarkdown()                      // Full MDX
docs.toMarkdown({ export: 'useState' }) // Single export
docs.toHTML()                          // Standalone HTML
docs.toJSON()                          // Structured JSON
docs.toNavigation()                    // Sidebar structure
docs.toSearchIndex()                   // Search records
```

### CLI

```bash
# Generate MDX files for existing site
npx openpkg-docs generate ./openpkg.json --out ./docs/api

# Generate JSON for custom rendering
npx openpkg-docs generate ./openpkg.json --format json --out ./api.json

# Generate with navigation
npx openpkg-docs generate ./openpkg.json --out ./docs/api --nav fumadocs

# Build standalone site
npx openpkg-docs build ./openpkg.json --out ./api-docs

# Dev server with hot reload
npx openpkg-docs dev ./openpkg.json --port 3001
```

### React Components

```tsx
// Headless (unstyled, composable)
import { Signature, ParamTable, ExampleBlock } from '@openpkg-ts/doc-generator/react'

<Signature signature={fn.signatures[0]} />
<ParamTable params={fn.signatures[0].parameters} />
<ExampleBlock examples={fn.examples} />
```

```tsx
// Pre-styled (Tailwind v4)
import { FunctionPage, ClassPage } from '@openpkg-ts/doc-generator/react/styled'

<FunctionPage export={fn} />
<ClassPage export={cls} />
```

### Styled Components Setup (Fumadocs)

Pre-styled components require CSS variables and Tailwind configuration for proper theming and syntax highlighting.

#### 1. Install adapter

```bash
npm install @openpkg-ts/fumadocs-adapter
```

#### 2. Import CSS

Add to your global CSS (e.g., `app/global.css`):

```css
@import 'tailwindcss';
@import 'fumadocs-ui/css/neutral.css';
@import 'fumadocs-ui/css/preset.css';
@import '@openpkg-ts/fumadocs-adapter/css';
```

This provides:
- `--dk-*` variables for DocsKit code blocks
- `--ch-*` variables for CodeHike syntax highlighting (GitHub theme)
- `--api-*` variables for API reference styling
- Light/dark mode support

#### 3. Tailwind v4 source scanning

Tailwind v4 excludes `node_modules` by default. Add this directive to scan styled component classes:

```css
@source "../node_modules/@openpkg-ts/doc-generator/dist/**/*.js";
```

Without this, utility classes like `lg:grid-cols-[1fr,minmax(0,420px)]` won't be included in your build.

#### 4. Layout requirements

Styled components use a two-column layout at the `lg:` breakpoint (1024px). For best results:

- Content area should be >= 1024px wide
- In Fumadocs, consider using `full` layout for API pages or hiding the TOC to maximize content width
- On narrower viewports, the layout stacks vertically

## API Reference

### Core Functions

#### `createDocs(input: string | OpenPkg): DocsInstance`

Create a docs instance from file path or spec object.

```ts
const docs = createDocs('./openpkg.json')
// or
const docs = createDocs(specObject)
```

#### `loadSpec(spec: OpenPkg): DocsInstance`

Create a docs instance from spec object directly.

### DocsInstance Methods

| Method | Description |
|--------|-------------|
| `getExport(id)` | Get export by ID |
| `getExportsByKind(kind)` | Get exports of specific kind |
| `getExportsByTag(tag)` | Get exports with JSDoc tag |
| `search(query)` | Search by name/description |
| `getDeprecated()` | Get deprecated exports |
| `groupByKind()` | Group exports by kind |
| `toMarkdown(options?)` | Render to MDX |
| `toHTML(options?)` | Render to HTML |
| `toJSON(options?)` | Render to JSON |
| `toNavigation(options?)` | Generate navigation |
| `toSearchIndex(options?)` | Generate search index |

### Query Utilities

```ts
import {
  formatSchema,
  buildSignatureString,
  getMethods,
  getProperties,
  groupByVisibility,
  sortByName,
} from '@openpkg-ts/doc-generator'

formatSchema({ type: 'string' }) // 'string'
buildSignatureString(fn) // 'function greet(name: string): string'
getMethods(classExport.members) // [{ name: 'foo', signatures: [...] }]
```

### Render Options

#### Markdown Options

```ts
docs.toMarkdown({
  export: 'greet',           // Single export mode
  frontmatter: true,         // Include YAML frontmatter
  codeSignatures: true,      // Use code blocks for signatures
  headingOffset: 1,          // Start at h2 instead of h1
  sections: {
    signature: true,
    description: true,
    parameters: true,
    returns: true,
    examples: true,
  },
})
```

#### HTML Options

```ts
docs.toHTML({
  export: 'greet',           // Single export mode
  fullDocument: true,        // Wrap in HTML document
  includeStyles: true,       // Include default CSS
  customCSS: '.custom {}',   // Custom CSS to inject
  title: 'API Reference',    // Page title
})
```

#### Navigation Options

```ts
docs.toNavigation({
  format: 'fumadocs',        // 'fumadocs' | 'docusaurus' | 'generic'
  groupBy: 'kind',           // 'kind' | 'module' | 'tag' | 'none'
  basePath: '/api',          // Base URL for links
  sortAlphabetically: true,  // Sort exports by name
})
```

#### Search Options

```ts
docs.toSearchIndex({
  baseUrl: '/docs/api',
  includeMembers: true,
  includeParameters: true,
  weights: {
    name: 10,
    description: 5,
    signature: 3,
  },
})
```

## React Components

### Headless Components

Unstyled, composable primitives for building custom UIs:

| Component | Props | Description |
|-----------|-------|-------------|
| `Signature` | `SignatureProps` | Render type signature |
| `ParamTable` | `ParamTableProps` | Parameter table |
| `TypeTable` | `TypeTableProps` | Type properties table |
| `MembersTable` | `MembersTableProps` | Class/interface members |
| `ExampleBlock` | `ExampleBlockProps` | Code examples |
| `CollapsibleMethod` | `CollapsibleMethodProps` | Expandable method |
| `ExpandableProperty` | `ExpandablePropertyProps` | Nested properties |

### Styled Components

Pre-styled with Tailwind v4:

| Component | Props | Description |
|-----------|-------|-------------|
| `FunctionPage` | `FunctionPageProps` | Function documentation |
| `ClassPage` | `ClassPageProps` | Class documentation |
| `InterfacePage` | `InterfacePageProps` | Interface documentation |
| `EnumPage` | `EnumPageProps` | Enum documentation |
| `VariablePage` | `VariablePageProps` | Variable documentation |
| `APIPage` | `APIPageProps` | Full API page wrapper |

## CLI Commands

### `generate`

Generate MDX or JSON files from OpenPkg spec.

```bash
openpkg-docs generate <spec> [options]

Options:
  -o, --out <dir>       Output directory (default: ./api-docs)
  -f, --format <type>   Output format: mdx or json (default: mdx)
  --nav <format>        Navigation: fumadocs, docusaurus, generic
  --flat                Flat file structure
  --group-by <type>     Group by: kind, module, tag, none (default: kind)
  --base-path <path>    Base path for links (default: /api)
  --verbose             Verbose output
```

### `build`

Build standalone HTML documentation site.

```bash
openpkg-docs build <spec> [options]

Options:
  -o, --out <dir>       Output directory (default: ./docs)
  --title <title>       Site title
  --search              Enable search index generation
  --verbose             Verbose output
```

### `dev`

Start development server with hot reload.

```bash
openpkg-docs dev <spec> [options]

Options:
  -p, --port <port>     Port number (default: 3000)
  --open                Open browser automatically
```

## Framework Integration

### Fumadocs

```ts
import { toFumadocsMetaJSON } from '@openpkg-ts/doc-generator'

const meta = toFumadocsMetaJSON(spec, { groupBy: 'kind' })
fs.writeFileSync('docs/api/meta.json', meta)
```

### Docusaurus

```ts
import { toDocusaurusSidebarJS } from '@openpkg-ts/doc-generator'

const sidebar = toDocusaurusSidebarJS(spec, { basePath: 'api' })
fs.writeFileSync('sidebars.js', sidebar)
```

## Search Integration

### Pagefind

```ts
import { toPagefindRecords } from '@openpkg-ts/doc-generator'

const records = toPagefindRecords(spec, {
  baseUrl: '/docs/api',
  weights: { name: 10, description: 5 },
})
```

### Algolia

```ts
import { toAlgoliaRecords } from '@openpkg-ts/doc-generator'

const records = toAlgoliaRecords(spec, { baseUrl: '/api' })
// Upload to Algolia index
```

## Migrating from TypeDoc

1. Generate OpenPkg spec using `@openpkg-ts/extract` or `@doccov/sdk`
2. Replace TypeDoc config with doc-generator CLI or API
3. Use React components for custom rendering

| TypeDoc | doc-generator |
|---------|---------------|
| `typedoc.json` | `openpkg.json` (spec) |
| `--out ./docs` | `--out ./docs` |
| `--theme minimal` | `toHTML()` or React components |
| Plugin system | Framework adapters |

## License

MIT
