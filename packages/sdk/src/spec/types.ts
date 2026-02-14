// ============================================================================
// Drift Types
// ============================================================================

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
  | 'prose-broken-reference'
  | 'prose-unresolved-member';

export type DriftCategory = 'structural' | 'semantic' | 'example' | 'prose';

export const DRIFT_CATEGORIES: Record<DriftType, DriftCategory> = {
  'param-mismatch': 'structural',
  'param-type-mismatch': 'structural',
  'return-type-mismatch': 'structural',
  'optionality-mismatch': 'structural',
  'generic-constraint-mismatch': 'structural',
  'property-type-drift': 'structural',
  'async-mismatch': 'structural',
  'deprecated-mismatch': 'semantic',
  'visibility-mismatch': 'semantic',
  'broken-link': 'semantic',
  'example-drift': 'example',
  'example-syntax-error': 'example',
  'example-runtime-error': 'example',
  'example-assertion-failed': 'example',
  'prose-broken-reference': 'prose',
  'prose-unresolved-member': 'prose',
};

export const DRIFT_CATEGORY_LABELS: Record<DriftCategory, string> = {
  structural: 'Signature mismatches',
  semantic: 'Metadata issues',
  example: 'Example problems',
  prose: 'Prose references',
};

export const DRIFT_CATEGORY_DESCRIPTIONS: Record<DriftCategory, string> = {
  structural: "JSDoc types or parameters don't match the actual code signature",
  semantic: 'Deprecation, visibility, or reference issues',
  example: "@example code has errors or doesn't work correctly",
  prose: 'Markdown docs import or reference non-existent exports',
};

export type DriftIssue = {
  type: DriftType;
  target?: string;
  issue: string;
  suggestion?: string;
  category: DriftCategory;
};

// ============================================================================
// Example Validation Types
// ============================================================================

export type ExampleTypecheckError = {
  exampleIndex: number;
  line: number;
  column: number;
  message: string;
};

export type ExampleRuntimeDrift = {
  exampleIndex: number;
  issue: string;
  suggestion?: string;
};

export type ExampleAnalysis = {
  typecheckErrors?: ExampleTypecheckError[];
  runtimeDrifts?: ExampleRuntimeDrift[];
};

// ============================================================================
// Coverage Types
// ============================================================================

export type MissingDocRule = 'description' | 'params' | 'returns' | 'examples' | 'throws';

// ============================================================================
// Documentation Health Types
// ============================================================================

/**
 * Unified documentation health score combining completeness and accuracy.
 */
export type DocumentationHealth = {
  /** Overall health score (0-100), weighted combination of completeness + accuracy */
  score: number;

  /** Completeness (coverage) metrics */
  completeness: {
    /** Completeness score (0-100) */
    score: number;
    /** Number of documented exports */
    documented: number;
    /** Total exports analyzed */
    total: number;
    /** Missing docs by rule */
    missing: Record<MissingDocRule, number>;
  };

  /** Accuracy (drift) metrics */
  accuracy: {
    /** Accuracy score (0-100) */
    score: number;
    /** Total drift issues found */
    issues: number;
    /** Issues by category */
    byCategory: Record<DriftCategory, number>;
  };

  /** Example validation metrics (if run) */
  examples?: {
    /** Example score (0-100) */
    score: number;
    /** Examples that passed validation */
    passed: number;
    /** Examples that failed validation */
    failed: number;
    /** Total examples analyzed */
    total: number;
  };
};

// ============================================================================
// Drift Spec (drift.json schema)
// ============================================================================

export type DriftSpecVersion = '0.1.0' | '1.0.0';

export type DriftSpec = {
  $schema?: string;
  drift: DriftSpecVersion;

  /** Reference to source spec */
  source: {
    file: string;
    specVersion?: string;
    packageName: string;
    packageVersion?: string;
  };

  generatedAt: string;

  /** Aggregate coverage summary */
  summary: DriftSummary;

  /** Per-export analysis, keyed by openpkg export ID */
  exports: Record<string, ExportAnalysis>;

  /** API surface completeness analysis */
  apiSurface?: ApiSurfaceResult;
};

export type DriftSummary = {
  /**
   * Overall coverage score (0-100)
   * @deprecated Use `health.completeness.score` instead. Will be removed in next major.
   */
  score: number;

  /**
   * Total exports analyzed
   * @deprecated Use `health.completeness.total` instead. Will be removed in next major.
   */
  totalExports: number;

  /**
   * Exports with complete documentation
   * @deprecated Use `health.completeness.documented` instead. Will be removed in next major.
   */
  documentedExports: number;

  /**
   * Missing documentation by rule
   * @deprecated Use `health.completeness.missing` instead. Will be removed in next major.
   */
  missingByRule: Record<MissingDocRule, number>;

  /**
   * Drift summary
   * @deprecated Use `health.accuracy` instead. Will be removed in next major.
   */
  drift: {
    total: number;
    byCategory: Record<DriftCategory, number>;
  };

  /**
   * Example validation summary (if run)
   * @deprecated Use `health.examples` instead. Will be removed in next major.
   */
  examples?: {
    total: number;
    withExamples: number;
    typecheckPassed?: number;
    typecheckFailed?: number;
    runtimePassed?: number;
    runtimeFailed?: number;
  };

  /** Unified documentation health metrics */
  health?: DocumentationHealth;
};

export type ExportAnalysis = {
  /** Coverage score for this export (0-100) */
  coverageScore: number;

  /** Missing documentation rules */
  missing?: MissingDocRule[];

  /** Drift issues */
  drift?: DriftIssue[];

  /** Example validation results */
  examples?: ExampleAnalysis;

  /** Number of overloads if > 1 (for overloaded functions) */
  overloadCount?: number;
};

// ============================================================================
// API Surface Types (Forgotten Exports)
// ============================================================================

/** Location context for where a type is referenced */
export type TypeReferenceLocation =
  | 'return'
  | 'parameter'
  | 'property'
  | 'extends'
  | 'type-parameter';

/** A type referenced in public API but not exported */
export type ForgottenExport = {
  /** Name of the forgotten type */
  name: string;

  /** Where the type is defined (file path) */
  definedIn?: { file: string; line?: number };

  /** Which exports reference this type */
  referencedBy: Array<{ exportName: string; location: TypeReferenceLocation }>;

  /** Whether type is from external package */
  isExternal: boolean;

  /** Suggested fix if applicable */
  fix?: { targetFile: string; exportStatement: string };
};

/** API Surface analysis result */
export type ApiSurfaceResult = {
  /** Total types referenced in public API */
  totalReferenced: number;

  /** Types that are properly exported */
  exported: number;

  /** Types referenced but not exported */
  forgotten: ForgottenExport[];

  /** Completeness percentage (exported / totalReferenced * 100) */
  completeness: number;
};
