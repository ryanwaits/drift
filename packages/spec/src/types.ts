export type SpecTag = {
  name: string;
  text: string;
};

// Priority 2: Type alias structural representation
export type SpecTypeAliasKind = 'alias' | 'conditional' | 'mapped' | 'template-literal' | 'infer';

export type SpecConditionalType = {
  checkType: string;
  extendsType: string;
  trueType: string;
  falseType: string;
};

export type SpecMappedType = {
  typeParameter: string;
  nameType?: string;
  valueType?: string;
  readonly?: '+' | '-' | true;
  optional?: '+' | '-' | true;
};

// Priority 2: Decorator representation
export type SpecDecorator = {
  name: string;
  arguments?: unknown[];
  argumentsText?: string[];
};

// Priority 2: Throws documentation
export type SpecThrows = {
  type?: string;
  description?: string;
};

export type SpecSource = {
  file?: string;
  line?: number;
  url?: string;
  /** Package name for external types (e.g., "@stacks/common") */
  package?: string;
  /** Package version for external types (e.g., "7.0.0") */
  version?: string;
};

// Priority 3: SpecSchema DSL - Proper discriminated union for type schemas

// Primitive types
export type SpecSchemaPrimitive =
  | { type: 'string'; format?: string; enum?: string[] }
  | { type: 'number'; enum?: number[] }
  | { type: 'boolean'; enum?: boolean[] }
  | { type: 'integer'; format?: string }
  | { type: 'null' }
  | { type: 'undefined' }
  | { type: 'any' }
  | { type: 'unknown' }
  | { type: 'never' }
  | { type: 'void' };

// Composite types
export type SpecSchemaComposite =
  | { type: 'array'; items?: SpecSchema }
  | { type: 'tuple'; items: SpecSchema[]; minItems?: number; maxItems?: number }
  | {
      type: 'object';
      properties?: Record<string, SpecSchema>;
      required?: string[];
      additionalProperties?: boolean | SpecSchema;
      description?: string;
    }
  | { type: 'function'; signatures?: SpecSignature[] };

// Combinators
export type SpecSchemaCombinator =
  | { anyOf: SpecSchema[]; discriminator?: { propertyName: string } }
  | { allOf: SpecSchema[] }
  | { oneOf: SpecSchema[] };

// Reference with optional type arguments for generics
export type SpecSchemaRef = { $ref: string; typeArguments?: SpecSchema[] };

// Fallback for complex TS types that can't be fully represented in JSON Schema
export type SpecSchemaFallback = { type: string };

// Generic object for SDK compatibility (allows Record<string, unknown> produced at runtime)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SpecSchemaGeneric = Record<string, unknown>;

// Main union - flexible JSON Schema patterns
// Note: SpecSchemaGeneric is last to allow type inference for the more specific variants first
export type SpecSchema =
  | string // Shorthand: "string", "number", etc.
  | SpecSchemaPrimitive
  | SpecSchemaComposite
  | SpecSchemaCombinator
  | SpecSchemaRef
  | SpecSchemaFallback
  | SpecSchemaGeneric;

// Priority 3: Structured example metadata
export type SpecExampleLanguage = 'ts' | 'js' | 'tsx' | 'jsx' | 'shell' | 'json';

export type SpecExample = {
  code: string;
  title?: string;
  description?: string;
  language?: SpecExampleLanguage;
};

export type SpecExtension = Record<string, unknown>;

/** Presentation metadata for an export/type (moved from inline fields) */
export type SpecPresentationMeta = {
  slug?: string;
  displayName?: string;
  category?: string;
  importPath?: string;
  alias?: string;
};

/** Extensions structure with typed presentation field */
export type SpecExtensions = {
  presentation?: Record<string, SpecPresentationMeta>;
  [key: string]: unknown;
};

export type SpecVisibility = 'public' | 'protected' | 'private';

export type SpecTypeParameter = {
  name: string;
  constraint?: string;
  default?: string;
};

export type SpecSignatureParameter = {
  name: string;
  required?: boolean;
  description?: string;
  schema: SpecSchema;
  default?: unknown;
  rest?: boolean;
  decorators?: SpecDecorator[];
};

export type SpecSignatureReturn = {
  schema: SpecSchema;
  description?: string;
};

export type SpecSignature = {
  parameters?: SpecSignatureParameter[];
  returns?: SpecSignatureReturn;
  description?: string;
  typeParameters?: SpecTypeParameter[];
  overloadIndex?: number;
  isImplementation?: boolean;
  throws?: SpecThrows[];
};

export type SpecMember = {
  id?: string;
  name?: string;
  kind?: string;
  description?: string;
  tags?: SpecTag[];
  visibility?: SpecVisibility;
  flags?: Record<string, unknown>;
  schema?: SpecSchema;
  signatures?: SpecSignature[];
  decorators?: SpecDecorator[];
};

export type SpecExportKind =
  | 'function'
  | 'class'
  | 'variable'
  | 'interface'
  | 'type'
  | 'enum'
  | 'module'
  | 'namespace'
  | 'reference'
  | 'external';

export type SpecTypeKind = 'class' | 'interface' | 'type' | 'enum' | 'external';

export type SpecExport = {
  id: string;
  name: string;
  kind: SpecExportKind;
  signatures?: SpecSignature[];
  typeParameters?: SpecTypeParameter[];
  members?: SpecMember[];
  type?: string | SpecSchema;
  schema?: SpecSchema;
  description?: string;
  examples?: (string | SpecExample)[];
  source?: SpecSource;
  deprecated?: boolean;
  flags?: Record<string, unknown>;
  tags?: SpecTag[];
  extends?: string;
  implements?: string[];
  typeAliasKind?: SpecTypeAliasKind;
  conditionalType?: SpecConditionalType;
  mappedType?: SpecMappedType;
  decorators?: SpecDecorator[];
};

export type SpecType = {
  id: string;
  name: string;
  kind: SpecTypeKind;
  description?: string;
  schema?: SpecSchema;
  type?: string | SpecSchema;
  members?: SpecMember[];
  source?: SpecSource;
  tags?: SpecTag[];
  rawComments?: string;
  extends?: string;
  implements?: string[];
  typeAliasKind?: SpecTypeAliasKind;
  conditionalType?: SpecConditionalType;
  mappedType?: SpecMappedType;
  /** Whether this type is from an external package (node_modules) */
  external?: boolean;
};

export type OpenPkgMeta = {
  name: string;
  version?: string;
  description?: string;
  license?: string;
  repository?: string;
  ecosystem?: string;
};

// ============================================================================
// Spec Generation Metadata
// ============================================================================

/**
 * Method used to detect the entry point for analysis.
 */
export type EntryPointDetectionMethod =
  | 'types' // package.json types/typings field
  | 'exports' // package.json exports field
  | 'main' // package.json main field
  | 'module' // package.json module field
  | 'fallback' // Convention-based (src/index.ts, etc.)
  | 'explicit' // User-specified entry point
  | 'llm'; // LLM-detected entry point

/**
 * Severity level for issues encountered during spec generation.
 */
export type GenerationIssueSeverity = 'error' | 'warning' | 'info';

/**
 * An issue encountered during spec generation.
 */
export type GenerationIssue = {
  /** Machine-readable issue code */
  code: string;
  /** Human-readable issue message */
  message: string;
  /** Severity level */
  severity: GenerationIssueSeverity;
  /** Suggested resolution */
  suggestion?: string;
};

/**
 * Metadata about how a spec was generated.
 * Provides transparency about the analysis process and any limitations.
 */
export type SpecGenerationInfo = {
  /** ISO 8601 timestamp of when the spec was generated */
  timestamp: string;

  /** Information about the tool that generated the spec */
  generator: {
    /** Tool name (e.g., '@doccov/cli', '@doccov/api') */
    name: string;
    /** Tool version */
    version: string;
  };

  /** Details about the analysis process */
  analysis: {
    /** Entry point file that was analyzed (relative path) */
    entryPoint: string;
    /** How the entry point was detected */
    entryPointSource: EntryPointDetectionMethod;
    /** Whether this was a declaration-only analysis (.d.ts file) */
    isDeclarationOnly: boolean;
    /** Whether external types from node_modules were resolved */
    resolvedExternalTypes: boolean;
    /** Maximum type depth used for nested type resolution */
    maxTypeDepth?: number;
    /** Schema extraction method and metadata */
    schemaExtraction?: {
      /** How schemas were extracted */
      method: 'standard-json-schema' | 'static-ast' | 'hybrid';
      /** Number of schemas extracted via Standard Schema runtime */
      runtimeCount?: number;
      /** Vendors detected (e.g., ['zod', 'valibot']) */
      vendors?: string[];
    };
  };

  /** Environment information during generation */
  environment: {
    /** Detected package manager */
    packageManager?: string;
    /** Whether node_modules was available for type resolution */
    hasNodeModules: boolean;
    /** Whether this is a monorepo */
    isMonorepo?: boolean;
    /** Target package name (for monorepos) */
    targetPackage?: string;
  };

  /** Issues encountered during generation */
  issues: GenerationIssue[];

  /** Whether the result came from cache */
  fromCache?: boolean;
};

/** Supported OpenPkg spec versions */
export type OpenPkgVersion = '0.2.0' | '0.3.0' | '0.4.0';

/** Minimal generation metadata for v0.4.0 */
export type SpecGenerationMeta = {
  generator?: string;
  timestamp?: string;
};

export type OpenPkg = {
  $schema?: string;
  openpkg: OpenPkgVersion;
  meta: OpenPkgMeta;
  exports: SpecExport[];
  types?: SpecType[];
  examples?: SpecExample[];
  extensions?: SpecExtensions;
  /** Optional generation metadata (minimal in v0.4.0) */
  generation?: SpecGenerationMeta | SpecGenerationInfo;
};
