/**
 * Drift-owned input types.
 *
 * Language-agnostic contract for drift analysis. Any language adapter
 * (TypeScript via openpkg-ts, Clarity, CLI introspection) can produce
 * an ApiSpec and feed it into the analysis pipeline.
 */

// ─── Top-level spec ──────────────────────────────────────────────────────────

export type ApiSpec = {
  meta: { name: string; version?: string };
  exports: ApiExport[];
  types?: ApiType[];
};

// ─── Exports ─────────────────────────────────────────────────────────────────

export type ApiExport = {
  id: string;
  name: string;
  kind: string;
  description?: string;
  tags?: ApiTag[];
  signatures?: ApiSignature[];
  examples?: (string | ApiExample)[];
  deprecated?: boolean;
  schema?: ApiSchema;
  type?: string | ApiSchema;
  members?: ApiMember[];
  source?: ApiSource;
  flags?: Record<string, unknown>;
  typeParameters?: ApiTypeParameter[];
  extends?: string;
  implements?: string[];
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type ApiType = {
  id: string;
  name: string;
  kind: string;
  description?: string;
  schema?: ApiSchema;
  type?: string | ApiSchema;
  members?: ApiMember[];
  source?: ApiSource;
  tags?: ApiTag[];
  extends?: string;
  implements?: string[];
};

// ─── Shared shapes ───────────────────────────────────────────────────────────

export type ApiTag = {
  name: string;
  text: string;
  param?: { name: string; type?: string; description?: string; optional?: boolean };
};

export type ApiSchema = string | Record<string, unknown>;

export type ApiSignature = {
  parameters?: ApiSignatureParameter[];
  returns?: ApiSignatureReturn;
  typeParameters?: ApiTypeParameter[];
  description?: string;
  tags?: ApiTag[];
  examples?: (string | ApiExample)[];
  throws?: ApiThrows[];
};

export type ApiSignatureParameter = {
  name: string;
  required?: boolean;
  description?: string;
  schema: ApiSchema;
  default?: unknown;
  rest?: boolean;
};

export type ApiSignatureReturn = {
  schema: ApiSchema;
  description?: string;
};

export type ApiMember = {
  id?: string;
  name?: string;
  kind?: string;
  description?: string;
  tags?: ApiTag[];
  visibility?: string;
  schema?: ApiSchema;
  signatures?: ApiSignature[];
  deprecated?: boolean;
};

export type ApiExample = {
  code: string;
  title?: string;
  description?: string;
  language?: string;
};

export type ApiSource = {
  file?: string;
  line?: number;
  url?: string;
};

export type ApiTypeParameter = {
  name: string;
  constraint?: string;
  default?: string;
};

export type ApiThrows = {
  type?: string;
  description?: string;
};
