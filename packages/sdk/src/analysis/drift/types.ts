import type { SpecSchema, SpecTag } from '@openpkg-ts/spec';

// ============================================================================
// Doccov-specific Drift Types (moved from @openpkg-ts/spec v0.4.0)
// ============================================================================

/**
 * All possible drift type identifiers.
 */
export type DriftType =
  | 'param-mismatch'
  | 'param-type-mismatch'
  | 'return-type-mismatch'
  | 'generic-constraint-mismatch'
  | 'optionality-mismatch'
  | 'deprecated-mismatch'
  | 'visibility-mismatch'
  | 'async-mismatch'
  | 'property-type-drift'
  | 'example-drift'
  | 'example-syntax-error'
  | 'example-runtime-error'
  | 'example-assertion-failed'
  | 'broken-link'
  | 'prose-broken-reference';

export type SpecDocDrift = {
  type: DriftType;
  target?: string;
  issue: string;
  /** Expected value from JSDoc/documentation */
  expected?: string;
  /** Actual value from TypeScript signature/code */
  actual?: string;
  /** Actionable suggestion for fixing the drift */
  suggestion?: string;
  /** Source file path (for prose drift) */
  filePath?: string;
  /** Source line number (for prose drift) */
  line?: number;
};

/**
 * Drift categories group related drift types for progressive disclosure.
 */
export type DriftCategory = 'structural' | 'semantic' | 'example' | 'prose';

/**
 * Maps each drift type to its category.
 */
export const DRIFT_CATEGORIES: Record<DriftType, DriftCategory> = {
  // Structural: signature/type mismatches
  'param-mismatch': 'structural',
  'param-type-mismatch': 'structural',
  'return-type-mismatch': 'structural',
  'optionality-mismatch': 'structural',
  'generic-constraint-mismatch': 'structural',
  'property-type-drift': 'structural',
  'async-mismatch': 'structural',

  // Semantic: metadata/visibility mismatches
  'deprecated-mismatch': 'semantic',
  'visibility-mismatch': 'semantic',
  'broken-link': 'semantic',

  // Example: code example issues
  'example-drift': 'example',
  'example-syntax-error': 'example',
  'example-runtime-error': 'example',
  'example-assertion-failed': 'example',

  // Prose: markdown documentation references
  'prose-broken-reference': 'prose',
};

/**
 * Human-readable category labels.
 */
export const DRIFT_CATEGORY_LABELS: Record<DriftCategory, string> = {
  structural: 'Signature mismatches',
  semantic: 'Metadata issues',
  example: 'Example problems',
  prose: 'Prose references',
};

/**
 * Category descriptions for help text.
 */
export const DRIFT_CATEGORY_DESCRIPTIONS: Record<DriftCategory, string> = {
  structural: "JSDoc types or parameters don't match the actual code signature",
  semantic: 'Deprecation, visibility, or reference issues',
  example: "@example code has errors or doesn't work correctly",
  prose: 'Markdown docs import or reference non-existent exports',
};

export type SpecDocsMetadata = {
  coverageScore?: number;
  missing?: string[];
  drift?: SpecDocDrift[];
};

// ============================================================================

/**
 * Result of computing drift for a single export.
 */
export type ExportDriftResult = {
  id: string;
  drift: SpecDocDrift[];
};

/**
 * Result of computing drift for all exports.
 */
export type DriftResult = {
  exports: Map<string, SpecDocDrift[]>;
};

/**
 * Information about an export for context-aware suggestions.
 */
export interface ExportInfo {
  name: string;
  kind: string;
  isCallable: boolean;
}

/**
 * Registry of exports and types for cross-reference validation.
 */
export interface ExportRegistry {
  /** Map of export names to their info (for context-aware suggestions) */
  exports: Map<string, ExportInfo>;
  /** Set of type names (interfaces, type aliases, etc.) */
  types: Set<string>;
  /** Combined set of all names (for backward compatibility) */
  all: Set<string>;
  /** Pre-computed candidate lists for fuzzy matching (performance optimization) */
  callableNames: string[];
  typeNames: string[];
  allExportNames: string[];
  allNames: string[];
}

/**
 * Parsed @param tag from JSDoc.
 */
export type ParsedParamTag = {
  name?: string;
  type?: string;
  isOptional?: boolean;
};

/**
 * Parsed @template tag from JSDoc.
 */
export type DocumentedTemplateTag = {
  name: string;
  constraint?: string;
};

/**
 * Visibility from TypeScript code.
 */
export type CodeVisibility = 'public' | 'protected' | 'private';

/**
 * Visibility from JSDoc tags.
 */
export type DocVisibility = 'internal' | 'protected' | 'private' | 'public';

/**
 * Signal of visibility from JSDoc.
 */
export type DocVisibilitySignal = {
  value: DocVisibility;
  tagName: string;
};

/**
 * Spec member with visibility info.
 */
export type SpecMemberWithVisibility = {
  id?: string;
  name?: string;
  visibility?: CodeVisibility;
  tags?: SpecTag[];
  kind?: string;
};

/**
 * Spec member with type info.
 */
export type SpecMemberWithType = {
  id?: string;
  name?: string;
  kind?: string;
  tags?: SpecTag[];
  schema?: SpecSchema;
};

/**
 * Extended drift with category and fixability metadata.
 */
export interface CategorizedDrift extends SpecDocDrift {
  category: DriftCategory;
  fixable: boolean;
}

/**
 * Summary of drift issues by category.
 */
export interface DriftSummary {
  total: number;
  byCategory: Record<DriftCategory, number>;
  fixable: number;
}

/**
 * Match result from fuzzy matching.
 */
export type ClosestMatch = {
  value: string;
  distance: number;
};
