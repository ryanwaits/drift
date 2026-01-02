import type { OpenPkg, SpecExport, SpecExportKind } from '@openpkg-ts/spec';
import { buildSignatureString, getMethods, getProperties } from './query';

export interface SearchOptions {
  /** Base URL for search result links */
  baseUrl?: string;
  /** Custom slug generator */
  slugify?: (name: string) => string;
  /** Include type signatures in search content */
  includeSignatures?: boolean;
  /** Include member names in search content */
  includeMembers?: boolean;
  /** Include parameter names in search content */
  includeParameters?: boolean;
  /** Weight multipliers for ranking */
  weights?: {
    name?: number;
    description?: number;
    signature?: number;
    tags?: number;
  };
}

// Pagefind-compatible record format
export interface PagefindRecord {
  url: string;
  content: string;
  word_count: number;
  filters: Record<string, string[]>;
  meta: {
    title: string;
    kind?: string;
    description?: string;
    signature?: string;
  };
  anchors?: Array<{ element: string; id: string; text: string }>;
  weighted_sections?: Array<{ weight: number; text: string }>;
}

// Algolia-compatible record format
export interface AlgoliaRecord {
  objectID: string;
  name: string;
  kind: SpecExportKind;
  description?: string;
  signature: string;
  content: string;
  tags: string[];
  deprecated: boolean;
  url: string;
  hierarchy: {
    lvl0: string;
    lvl1: string;
    lvl2?: string;
  };
  _rankingInfo?: {
    nbTypos: number;
    words: number;
  };
}

// Generic search index format
export interface SearchRecord {
  id: string;
  name: string;
  kind: SpecExportKind;
  signature: string;
  description?: string;
  content: string;
  keywords: string[];
  url: string;
  deprecated: boolean;
}

export interface SearchIndex {
  records: SearchRecord[];
  version: string;
  generatedAt: string;
  packageName: string;
}

const defaultSlugify = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * Extract keywords from export.
 */
function extractKeywords(exp: SpecExport, options: SearchOptions = {}): string[] {
  const keywords = new Set<string>();

  // Name variations
  keywords.add(exp.name);
  keywords.add(exp.name.toLowerCase());

  // Camel case split: useState -> use, State
  const camelParts = exp.name.split(/(?=[A-Z])/);
  for (const part of camelParts) {
    if (part.length > 2) keywords.add(part.toLowerCase());
  }

  // Tags
  if (exp.tags) {
    for (const tag of exp.tags) {
      keywords.add(tag.name.replace('@', ''));
      const tagWords = tag.text.split(/\s+/);
      for (const word of tagWords) {
        if (word.length > 2) keywords.add(word.toLowerCase());
      }
    }
  }

  // Description words
  if (exp.description) {
    const descWords = exp.description
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2);
    for (const word of descWords) {
      keywords.add(word);
    }
  }

  // Member names
  if (options.includeMembers && exp.members) {
    for (const member of exp.members) {
      if (member.name) {
        keywords.add(member.name.toLowerCase());
      }
    }
  }

  // Parameter names
  if (options.includeParameters && exp.signatures) {
    for (const sig of exp.signatures) {
      for (const param of sig.parameters || []) {
        keywords.add(param.name.toLowerCase());
      }
    }
  }

  return Array.from(keywords);
}

/**
 * Build searchable content string.
 */
function buildContent(exp: SpecExport, options: SearchOptions = {}): string {
  const parts: string[] = [];

  // Name
  parts.push(exp.name);

  // Description
  if (exp.description) {
    parts.push(exp.description);
  }

  // Signature
  if (options.includeSignatures !== false) {
    parts.push(buildSignatureString(exp));
  }

  // Tags
  if (exp.tags) {
    parts.push(...exp.tags.map((t) => `${t.name} ${t.text}`));
  }

  // Members
  if (options.includeMembers !== false && exp.members) {
    const props = getProperties(exp.members);
    const methods = getMethods(exp.members);

    for (const prop of props) {
      if (prop.name) {
        parts.push(prop.name);
        if (prop.description) parts.push(prop.description);
      }
    }

    for (const method of methods) {
      if (method.name) {
        parts.push(method.name);
        if (method.description) parts.push(method.description);
      }
    }
  }

  // Parameters
  if (options.includeParameters !== false && exp.signatures) {
    for (const sig of exp.signatures) {
      for (const param of sig.parameters || []) {
        parts.push(param.name);
        if (param.description) parts.push(param.description);
      }
    }
  }

  return parts.join(' ');
}

/**
 * Create a search record for an export.
 */
function createSearchRecord(
  exp: SpecExport,
  _packageName: string,
  options: SearchOptions = {},
): SearchRecord {
  const { baseUrl = '/api', slugify = defaultSlugify } = options;

  return {
    id: exp.id,
    name: exp.name,
    kind: exp.kind,
    signature: buildSignatureString(exp),
    description: exp.description,
    content: buildContent(exp, options),
    keywords: extractKeywords(exp, options),
    url: `${baseUrl}/${slugify(exp.name)}`,
    deprecated: exp.deprecated === true,
  };
}

/**
 * Generate search index from spec.
 *
 * @param spec - The OpenPkg spec to index
 * @param options - Search index configuration
 * @returns Search index with records for each export
 *
 * @example
 * ```ts
 * import { createDocs } from '@openpkg-ts/doc-generator'
 *
 * const docs = createDocs('./openpkg.json')
 * const index = docs.toSearchIndex({ baseUrl: '/api' })
 * // { records: [...], version: '1.0.0', packageName: 'my-lib' }
 * ```
 */
export function toSearchIndex(spec: OpenPkg, options: SearchOptions = {}): SearchIndex {
  const records = spec.exports.map((exp) => createSearchRecord(exp, spec.meta.name, options));

  return {
    records,
    version: spec.meta.version || '0.0.0',
    generatedAt: new Date().toISOString(),
    packageName: spec.meta.name,
  };
}

/**
 * Generate Pagefind-compatible records.
 *
 * @param spec - The OpenPkg spec to index
 * @param options - Search configuration including weights
 * @returns Array of Pagefind-compatible search records
 *
 * @example
 * ```ts
 * const records = toPagefindRecords(spec, {
 *   baseUrl: '/docs/api',
 *   weights: { name: 10, description: 5 }
 * })
 * ```
 */
export function toPagefindRecords(spec: OpenPkg, options: SearchOptions = {}): PagefindRecord[] {
  const { baseUrl = '/api', slugify = defaultSlugify, weights = {} } = options;
  const { name: nameWeight = 10, description: descWeight = 5, signature: sigWeight = 3 } = weights;

  return spec.exports.map((exp) => {
    const content = buildContent(exp, options);
    const signature = buildSignatureString(exp);

    const filters: Record<string, string[]> = {
      kind: [exp.kind],
    };

    if (exp.deprecated) {
      filters.deprecated = ['true'];
    }

    if (exp.tags?.length) {
      filters.tags = exp.tags.map((t) => t.name.replace('@', ''));
    }

    return {
      url: `${baseUrl}/${slugify(exp.name)}`,
      content,
      word_count: content.split(/\s+/).length,
      filters,
      meta: {
        title: exp.name,
        kind: exp.kind,
        description: exp.description?.slice(0, 160),
        signature,
      },
      weighted_sections: [
        { weight: nameWeight, text: exp.name },
        ...(exp.description ? [{ weight: descWeight, text: exp.description }] : []),
        { weight: sigWeight, text: signature },
      ],
    };
  });
}

/**
 * Generate Algolia-compatible records.
 *
 * @param spec - The OpenPkg spec to index
 * @param options - Search configuration
 * @returns Array of Algolia-compatible search records with hierarchy
 *
 * @example
 * ```ts
 * const records = toAlgoliaRecords(spec, { baseUrl: '/api' })
 * // Upload to Algolia index
 * ```
 */
export function toAlgoliaRecords(spec: OpenPkg, options: SearchOptions = {}): AlgoliaRecord[] {
  const { baseUrl = '/api', slugify = defaultSlugify } = options;

  return spec.exports.map((exp) => ({
    objectID: exp.id,
    name: exp.name,
    kind: exp.kind,
    description: exp.description,
    signature: buildSignatureString(exp),
    content: buildContent(exp, options),
    tags: (exp.tags || []).map((t) => t.name.replace('@', '')),
    deprecated: exp.deprecated === true,
    url: `${baseUrl}/${slugify(exp.name)}`,
    hierarchy: {
      lvl0: spec.meta.name,
      lvl1: `${exp.kind.charAt(0).toUpperCase() + exp.kind.slice(1)}s`,
      lvl2: exp.name,
    },
  }));
}

/**
 * Serialize search index to JSON string.
 *
 * @param spec - The OpenPkg spec to index
 * @param options - Search options plus pretty formatting option
 * @returns JSON string of search index
 *
 * @example
 * ```ts
 * const json = toSearchIndexJSON(spec, { pretty: true })
 * fs.writeFileSync('search-index.json', json)
 * ```
 */
export function toSearchIndexJSON(
  spec: OpenPkg,
  options: SearchOptions & { pretty?: boolean } = {},
): string {
  const index = toSearchIndex(spec, options);
  return options.pretty ? JSON.stringify(index, null, 2) : JSON.stringify(index);
}
