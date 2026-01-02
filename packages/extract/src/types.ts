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
}

export interface ExtractResult {
  spec: OpenPkg;
  diagnostics: Diagnostic[];
}

export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
  location?: { file?: string; line?: number; column?: number };
}
