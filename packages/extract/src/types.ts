import type { OpenPkg } from '@openpkg-ts/spec';

export interface ExtractOptions {
  entryFile: string;
  baseDir?: string;
  content?: string; // For in-memory analysis
  maxTypeDepth?: number;
  maxExternalTypeDepth?: number;
  resolveExternalTypes?: boolean;
  schemaExtraction?: 'static' | 'hybrid';
  /** Include $schema URL in output */
  includeSchema?: boolean;
  /** Only extract these exports (supports * wildcards) */
  only?: string[];
  /** Ignore these exports (supports * wildcards) */
  ignore?: string[];
}

export interface ExtractResult {
  spec: OpenPkg;
  diagnostics: Diagnostic[];
  forgottenExports?: ForgottenExport[];
}

export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
  location?: { file?: string; line?: number; column?: number };
}

/** Context tracking for type references in public API */
export interface TypeReference {
  typeName: string;
  exportName: string;
  location: 'return' | 'parameter' | 'property' | 'extends' | 'type-parameter';
  path?: string;
}

/** Structured data for forgotten exports */
export interface ForgottenExport {
  name: string;
  definedIn?: string;
  referencedBy: TypeReference[];
  isExternal: boolean;
  fix?: string;
}
