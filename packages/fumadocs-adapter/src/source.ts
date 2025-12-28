import type { Source, VirtualFile } from 'fumadocs-core/source';
import type { DocsInstance, OpenPkg, SpecExport, SpecExportKind } from '@openpkg-ts/doc-generator';
import { createDocs } from '@openpkg-ts/doc-generator';

export interface OpenPkgSourceOptions {
  /** OpenPkg spec or DocsInstance */
  spec: OpenPkg | DocsInstance;
  /** Base directory for pages (default: 'api') */
  baseDir?: string;
  /** Generate index page at baseDir/index.mdx (default: true) */
  indexPage?: boolean;
  /**
   * Navigation mode:
   * - 'pages': Individual pages per export grouped by kind (default)
   * - 'single': Single page with all exports and in-page navigation
   */
  mode?: 'pages' | 'single';
}

export interface OpenPkgPageData {
  title: string;
  description?: string;
  /** The export from the spec */
  export: SpecExport;
  /** The full OpenPkg spec */
  spec: OpenPkg;
}

export interface OpenPkgIndexPageData {
  title: string;
  description?: string;
  /** Index page marker */
  isIndex: true;
  /** The full OpenPkg spec */
  spec: OpenPkg;
}

/** Page data for single-page mode */
export interface OpenPkgSinglePageData {
  title: string;
  description?: string;
  /** Single page mode marker */
  isSinglePage: true;
  /** The full OpenPkg spec */
  spec: OpenPkg;
}

export interface OpenPkgMetaData {
  title: string;
  pages: string[];
  defaultOpen?: boolean;
}

const KIND_ORDER: SpecExportKind[] = [
  'function',
  'class',
  'interface',
  'type',
  'enum',
  'variable',
];

const KIND_LABELS: Partial<Record<SpecExportKind, string>> = {
  function: 'Functions',
  class: 'Classes',
  interface: 'Interfaces',
  type: 'Types',
  enum: 'Enums',
  variable: 'Variables',
  namespace: 'Namespaces',
  module: 'Modules',
  reference: 'References',
  external: 'External',
};

const KIND_SLUGS: Partial<Record<SpecExportKind, string>> = {
  function: 'functions',
  class: 'classes',
  interface: 'interfaces',
  type: 'types',
  enum: 'enums',
  variable: 'variables',
  namespace: 'namespaces',
  module: 'modules',
  reference: 'references',
  external: 'externals',
};

function pluralizeKind(kind: SpecExportKind): string {
  return KIND_SLUGS[kind] || `${kind}s`;
}

/**
 * Create a virtual source for Fumadocs from an OpenPkg spec.
 *
 * This generates virtual pages grouped by export kind (functions, types, etc.)
 * that integrate with Fumadocs' loader and sidebar.
 *
 * @example
 * ```ts
 * // Multi-page mode (default) - individual pages per export
 * import { loader } from 'fumadocs-core/source';
 * import { openpkgSource } from '@openpkg-ts/fumadocs-adapter';
 * import spec from './openpkg.json';
 *
 * export const source = loader({
 *   baseUrl: '/docs/api',
 *   source: openpkgSource({ spec }),
 * });
 * ```
 *
 * @example
 * ```ts
 * // Single-page mode - all exports on one scrollable page
 * export const source = loader({
 *   baseUrl: '/docs/api',
 *   source: openpkgSource({ spec, mode: 'single' }),
 * });
 * ```
 */
export function openpkgSource(
  options: OpenPkgSourceOptions
): Source<{ pageData: OpenPkgPageData | OpenPkgIndexPageData | OpenPkgSinglePageData; metaData: OpenPkgMetaData }> {
  const { baseDir = 'api', indexPage = true, mode = 'pages' } = options;

  // Normalize to DocsInstance
  const docs: DocsInstance =
    'getAllExports' in options.spec ? options.spec : createDocs(options.spec);

  const spec = docs.spec;
  const exports = docs.getAllExports();

  const files: VirtualFile<{ pageData: OpenPkgPageData | OpenPkgIndexPageData | OpenPkgSinglePageData; metaData: OpenPkgMetaData }>[] = [];

  // Single-page mode: generate only one page entry
  if (mode === 'single') {
    // Create meta for the API section
    files.push({
      type: 'meta',
      path: `${baseDir}/meta.json`,
      data: {
        title: spec.meta.name || 'API Reference',
        pages: ['index'],
        defaultOpen: true,
      },
    });

    // Create single page with full spec
    files.push({
      type: 'page',
      path: `${baseDir}/index.mdx`,
      slugs: [],
      data: {
        title: spec.meta.name || 'API Reference',
        description: spec.meta.description,
        isSinglePage: true,
        spec,
      } as OpenPkgSinglePageData,
    });

    return { files };
  }

  // Multi-page mode (default)
  // Group exports by kind
  const groupedByKind = new Map<SpecExportKind, SpecExport[]>();
  for (const exp of exports) {
    const kind = exp.kind as SpecExportKind;
    if (!groupedByKind.has(kind)) {
      groupedByKind.set(kind, []);
    }
    groupedByKind.get(kind)!.push(exp);
  }

  // Create root meta for the API section
  const rootPages: string[] = [];

  // Add index page as first item if enabled
  if (indexPage) {
    rootPages.push('index');
  }

  for (const kind of KIND_ORDER) {
    if (groupedByKind.has(kind)) {
      rootPages.push(`...${pluralizeKind(kind)}`);
    }
  }

  files.push({
    type: 'meta',
    path: `${baseDir}/meta.json`,
    data: {
      title: spec.meta.name || 'API Reference',
      pages: rootPages,
      defaultOpen: true,
    },
  });

  // Create index page if enabled
  if (indexPage) {
    files.push({
      type: 'page',
      path: `${baseDir}/index.mdx`,
      slugs: [],
      data: {
        title: spec.meta.name || 'API Reference',
        description: spec.meta.description,
        isIndex: true,
        spec,
      } as OpenPkgIndexPageData,
    });
  }

  // Create pages and meta for each kind group
  for (const kind of KIND_ORDER) {
    const kindExports = groupedByKind.get(kind);
    if (!kindExports || kindExports.length === 0) continue;

    const kindSlug = pluralizeKind(kind);
    const kindDir = `${baseDir}/${kindSlug}`;
    const label = KIND_LABELS[kind] || kindSlug;

    // Sort exports alphabetically
    const sortedExports = [...kindExports].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Create meta for this kind folder
    files.push({
      type: 'meta',
      path: `${kindDir}/meta.json`,
      data: {
        title: label,
        pages: sortedExports.map((exp) => exp.id),
        defaultOpen: false,
      },
    });

    // Create a page for each export
    for (const exp of sortedExports) {
      files.push({
        type: 'page',
        path: `${kindDir}/${exp.id}.mdx`,
        slugs: [kindSlug, exp.id],
        data: {
          title: exp.name,
          description: exp.description,
          export: exp,
          spec,
        },
      });
    }
  }

  return { files };
}
