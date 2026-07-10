/**
 * Markdown/MDX documentation analysis types
 */

/**
 * A code block extracted from a markdown file
 */
export interface MarkdownCodeBlock {
  /** Language tag (ts, typescript, js, javascript, tsx, jsx) */
  lang: string;
  /** The code content */
  code: string;
  /** Raw meta string from code fence (e.g., "title=example.ts") */
  meta?: string;
  /** Starting line number in the markdown file */
  lineStart: number;
  /** Ending line number in the markdown file */
  lineEnd: number;
}

/**
 * A parsed markdown documentation file
 */
export interface MarkdownDocFile {
  /** File path relative to project root */
  path: string;
  /** All executable code blocks found */
  codeBlocks: MarkdownCodeBlock[];
  /** Raw file content (for prose context checks around code blocks) */
  content?: string;
}

/**
 * A reference to an export found in markdown
 */
export interface ExportReference {
  /** The name of the export being referenced */
  exportName: string;
  /** File path where the reference was found */
  file: string;
  /** Line number in the file */
  line: number;
  /** Surrounding code/text for context */
  context: string;
  /** Whether this reference is inside a code block */
  inCodeBlock: boolean;
  /** The code block index if inside a code block */
  blockIndex?: number;
}

/**
 * Change type for an impacted reference
 */
export type DocsChangeType =
  | 'signature-changed'
  | 'removed'
  | 'deprecated'
  | 'method-removed'
  | 'method-changed'
  | 'method-deprecated';

/**
 * Member-level change type
 */
export type MemberChangeType = 'added' | 'removed' | 'signature-changed';

/**
 * An impacted reference in a documentation file
 */
export interface DocsImpactReference {
  /** The export name that was changed */
  exportName: string;
  /** Line number in the file */
  line: number;
  /** Type of change affecting this reference */
  changeType: DocsChangeType;
  /** Suggested fix (AI-generated or deterministic) */
  suggestion?: string;
  /** Context around the reference */
  context?: string;
  /** Member/method name if this is a member-level change */
  memberName?: string;
  /** Type of member change (added, removed, signature-changed) */
  memberChangeType?: MemberChangeType;
  /** Suggested replacement for removed/changed members */
  replacementSuggestion?: string;
  /** True if this is just a class instantiation (new ClassName()) */
  isInstantiation?: boolean;
}

/**
 * Documentation file impact summary
 */
export interface DocsImpact {
  /** File path */
  file: string;
  /** All impacted references in this file */
  references: DocsImpactReference[];
}

/**
 * Complete docs impact analysis result
 */
export interface DocsImpactResult {
  /** Files with impacted references */
  impactedFiles: DocsImpact[];
  /** New exports (from this diff) that have no documentation */
  missingDocs: string[];
  /** ALL exports from the spec that have no documentation in the scanned files */
  allUndocumented: string[];
  /** Statistics */
  stats: {
    /** Total markdown files scanned */
    filesScanned: number;
    /** Total code blocks found */
    codeBlocksFound: number;
    /** Total export references found */
    referencesFound: number;
    /** References impacted by changes */
    impactedReferences: number;
    /** Total exports in the spec */
    totalExports: number;
    /** Exports found documented in markdown */
    documentedExports: number;
  };
}
