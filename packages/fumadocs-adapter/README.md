# @openpkg-ts/fumadocs-adapter

Fumadocs integration for OpenPkg API documentation. Provides CSS variables and theming for `@openpkg-ts/doc-generator` styled components.

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

Without this, utility classes like `lg:grid-cols-[1fr,minmax(0,420px)]` won't be included in your production build.

## Layout Requirements

Styled components use a two-column layout at the `lg:` breakpoint (1024px). For best results:

- Content area should be >= 1024px wide
- Consider using `full` layout for API pages or hiding the TOC to maximize content width
- On narrower viewports, the layout automatically stacks vertically

## Navigation Modes

Two navigation patterns are supported:

### Mode A: Single Page (Stripe-style)

All exports on one scrollable page with filters and optional TOC:

```tsx
// app/docs/(api)/api/page.tsx
import { FullAPIReferencePage, type OpenPkg } from '@openpkg-ts/fumadocs-adapter';
import spec from '@/lib/openpkg.json';

export default function APIPage() {
  return (
    <FullAPIReferencePage
      spec={spec as OpenPkg}
      title="API Reference"
      showTOC           // sticky sidebar navigation
      showFilters       // kind filter buttons (functions, types, etc.)
    />
  );
}
```

Props:
- `showTOC` - Enable sticky sidebar with anchor links
- `showFilters` - Show kind filter buttons (functions, classes, etc.)
- `kinds` - Limit to specific export kinds: `['function', 'type']`

### Mode B: Index + Individual Pages

Grid of cards linking to individual pages:

```tsx
// app/docs/(api)/api/page.tsx (index)
import { ExportIndexPage, type OpenPkg } from '@openpkg-ts/fumadocs-adapter';
import spec from '@/lib/openpkg.json';

export default function APIIndexPage() {
  return (
    <ExportIndexPage
      spec={spec as OpenPkg}
      baseHref="/docs/api"
      showSearch        // search input
      showFilters       // category filter buttons
    />
  );
}

// app/docs/(api)/api/[kind]/[slug]/page.tsx (detail)
import { FunctionPage, type OpenPkg, type SpecExport } from '@openpkg-ts/fumadocs-adapter';
import spec from '@/lib/openpkg.json';

export default function ExportDetailPage({ params }) {
  const exp = (spec as OpenPkg).exports.find(e => e.id === params.slug);
  return <FunctionPage export={exp as SpecExport} spec={spec as OpenPkg} />;
}
```

## Using openpkgSource for Fumadocs Integration

Generate a page tree for Fumadocs sidebar:

```tsx
// lib/api-source.ts
import { loader } from 'fumadocs-core/source';
import { openpkgSource, type OpenPkg } from '@openpkg-ts/fumadocs-adapter';
import spec from './openpkg.json';

export const apiSource = loader({
  baseUrl: '/docs/api',
  source: openpkgSource({ spec: spec as OpenPkg, baseDir: '' }),
});
```

Then use in your layout:

```tsx
// app/docs/(api)/layout.tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { apiSource } from '@/lib/api-source';

export default function APILayout({ children }) {
  return <DocsLayout tree={apiSource.pageTree}>{children}</DocsLayout>;
}
```

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

### CodeHike Variables (`--ch-*`)

GitHub syntax theme colors (`--ch-0` through `--ch-26`). Automatically adapts to light/dark mode.

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
