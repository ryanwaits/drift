/**
 * Docs-page key-coverage types: diff a spec type's property keys against the
 * option keys a docs page actually documents. Deterministic layer of the
 * "LLM writes the map, machine runs the map" split — see designs/docs-key-coverage.md.
 */

/** Where a documented key was found in the corpus. */
export interface DocumentedKeyLocation {
  file: string;
  /** 1-indexed line of the table row */
  line: number;
  /** Heading text of the section the row sits under */
  section: string;
  /** Raw first-cell token before dotted-prefix normalization */
  raw: string;
}

/** Deterministic extraction result over a docs corpus. */
export interface DocsKeyCorpus {
  /** Table-documented keys (section-scoped) → every location they appear */
  documented: Map<string, DocumentedKeyLocation[]>;
  /** Identifiers appearing in inline backticks anywhere in the corpus */
  inlineMentions: Set<string>;
  /** Full corpus text (for `key:` mention checks) */
  text: string;
}

/** Per-property metadata pulled from the spec. */
export interface KeyMeta {
  description?: string;
  deprecated?: boolean;
  deprecationReason?: string;
}

/** Agent-proposed, human-committed key annotations (docs-map `annotations`). */
export type KeyAnnotation = 'prose-documented' | 'internal-by-convention' | 'ignore';

export interface KeyCoverageOptions {
  /** Extra internal keys beyond the `_`-prefix convention */
  internal?: string[];
  /** Deprecated override for specs without per-property metadata */
  deprecated?: string[];
  /** Replacement override: deprecatedKey → replacementKey */
  replacements?: Record<string, string>;
  /** Committed per-key annotations from the docs map */
  annotations?: Record<string, KeyAnnotation>;
}

export interface KeyGap {
  key: string;
  /** Spec description, when the extractor preserved it */
  description?: string;
  /** Key appears in backticks or `key:` form somewhere in the corpus */
  mentioned: boolean;
}

export interface KeyGhost {
  key: string;
  locations: DocumentedKeyLocation[];
}

export interface KeyInversion {
  /** Deprecated key that IS documented */
  documented: string;
  /** Its replacement, which is NOT documented */
  replacement: string;
  /** Where the replacement came from */
  source: 'spec' | 'map';
}

export interface KeyCoverageResult {
  type: string;
  counts: {
    code: number;
    codePublic: number;
    documented: number;
    gapsUserFacing: number;
    ghosts: number;
    inversions: number;
  };
  documented: string[];
  gaps: {
    userFacing: KeyGap[];
    internal: string[];
    deprecated: string[];
  };
  ghosts: KeyGhost[];
  /** Documented keys that belong to OTHER spec types (sub-config tables) — not ghosts */
  documentedKeysFromOtherTypes: string[];
  inversions: KeyInversion[];
  /** Keys excluded by committed annotations */
  annotated: {
    proseDocumented: string[];
    ignored: string[];
  };
}
