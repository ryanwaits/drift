# @openpkg-ts/fumadocs-adapter

Fumadocs integration for OpenPkg API documentation. Provides virtual source generation, styled components, and theming.

## Installation

```bash
npm install @openpkg-ts/fumadocs-adapter
```

## CSS Setup

Import the CSS in your global stylesheet (e.g., `app/global.css`):

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
- Automatic light/dark mode support via Fumadocs theme

## Tailwind v4 Configuration

Tailwind v4 excludes `node_modules` by default. Add this directive to include styled component utility classes:

```css
@source "../node_modules/@openpkg-ts/doc-generator/dist/**/*.js";
```

## Navigation Modes

Two navigation patterns are supported via `openpkgSource`:

### Single-Page Mode

All exports on one scrollable page with filters and optional TOC:

```ts
// lib/api-source.ts
import { loader } from 'fumadocs-core/source';
import { openpkgSource, type OpenPkg } from '@openpkg-ts/fumadocs-adapter';
import spec from './openpkg.json';

export const apiSource = loader({
  baseUrl: '/docs/api',
  source: openpkgSource({
    spec: spec as OpenPkg,
    baseDir: 'api',
    mode: 'single',
  }),
});
```

```tsx
// app/docs/(api)/api/page.tsx
import { FullAPIReferencePage, type OpenPkg } from '@openpkg-ts/fumadocs-adapter';
import spec from '@/lib/openpkg.json';

export default function APIPage() {
  return (
    <FullAPIReferencePage
      spec={spec as OpenPkg}
      title="API Reference"
      showTOC        // sticky sidebar navigation
      showFilters    // kind filter buttons
    />
  );
}
```

```tsx
// app/docs/(api)/api/layout.tsx
import { apiSource } from '@/lib/api-source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';

export default function APILayout({ children }) {
  return <DocsLayout tree={apiSource.pageTree}>{children}</DocsLayout>;
}
```

### Multi-Page Mode

Index page with cards + individual pages per export:

```ts
// lib/api-source.ts
import { loader } from 'fumadocs-core/source';
import { openpkgSource, openpkgPlugin, type OpenPkg } from '@openpkg-ts/fumadocs-adapter';
import spec from './openpkg.json';

export const apiSource = loader({
  baseUrl: '/docs/reference',
  source: openpkgSource({
    spec: spec as OpenPkg,
    baseDir: 'reference',
    mode: 'pages',      // individual pages per export
    indexPage: true,    // generate index page with cards
  }),
  plugins: [openpkgPlugin()],  // adds kind badges to sidebar
});
```

```tsx
// app/docs/(reference)/reference/[[...slug]]/page.tsx
import { apiSource } from '@/lib/api-source';
import { notFound } from 'next/navigation';
import {
  APIPage,
  ExportIndexPage,
  type OpenPkgIndexPageData,
  type OpenPkgPageData,
} from '@openpkg-ts/fumadocs-adapter';

export default async function ReferencePage({ params }) {
  const { slug } = await params;
  const page = apiSource.getPage(slug);
  if (!page) notFound();

  const data = page.data;

  // Index page
  if ('isIndex' in data && data.isIndex) {
    return (
      <ExportIndexPage
        spec={data.spec}
        baseHref="/docs/reference"
      />
    );
  }

  // Individual export page
  return (
    <APIPage
      spec={data.spec}
      id={data.export.id}
      baseHref="/docs/reference"
    />
  );
}

export function generateStaticParams() {
  return apiSource.generateParams();
}
```

```tsx
// app/docs/(reference)/reference/layout.tsx
import { apiSource } from '@/lib/api-source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';

export default function ReferenceLayout({ children }) {
  return <DocsLayout tree={apiSource.pageTree}>{children}</DocsLayout>;
}
```

## openpkgSource Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `spec` | `OpenPkg` | required | The OpenPkg spec object |
| `baseDir` | `string` | `'api'` | Base directory for generated pages |
| `mode` | `'pages' \| 'single'` | `'pages'` | Navigation mode |
| `indexPage` | `boolean` | `true` | Generate index page (pages mode only) |

## FullAPIReferencePage Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `spec` | `OpenPkg` | required | The OpenPkg spec |
| `title` | `string` | spec.meta.name | Page title |
| `description` | `ReactNode` | - | Description below title |
| `showTOC` | `boolean` | `false` | Show sticky sidebar TOC |
| `showFilters` | `boolean` | `true` | Show kind filter buttons |
| `kinds` | `SpecExportKind[]` | all | Filter to specific kinds |

## CSS Variables Reference

### DocsKit Variables (`--dk-*`)

| Variable | Purpose |
|----------|---------|
| `--dk-background` | Code block background |
| `--dk-border` | Code block border |
| `--dk-tabs-background` | Tab bar background |
| `--dk-tab-inactive-foreground` | Inactive tab text |
| `--dk-tab-active-foreground` | Active tab text |
| `--dk-selection` | Text selection color |

### API Reference Variables (`--api-*`)

| Variable | Purpose |
|----------|---------|
| `--api-font-mono` | Monospace font stack |
| `--api-font-display` | Display font stack |
| `--api-bg-primary` | Primary background |
| `--api-bg-secondary` | Secondary background |
| `--api-bg-card` | Card background |
| `--api-border` | Border color |
| `--api-text-primary` | Primary text color |
| `--api-text-secondary` | Secondary text color |
| `--api-accent` | Accent color |
| `--api-accent-muted` | Muted accent background |

## License

MIT
