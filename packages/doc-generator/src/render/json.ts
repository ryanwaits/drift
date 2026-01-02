import type {
  OpenPkg,
  SpecExample,
  SpecExport,
  SpecExportKind,
  SpecMember,
  SpecSignature,
} from '@openpkg-ts/spec';
import { buildSignatureString, formatSchema } from '../core/query';

export interface JSONOptions {
  /** Include raw spec data alongside simplified data */
  includeRaw?: boolean;
  /** Export to render (single export mode) */
  export?: string;
  /** Include computed fields (signatures, formatted types) */
  computed?: boolean;
  /** Flatten nested structures */
  flatten?: boolean;
}

// Simplified output types for frontend consumption

export interface SimplifiedParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  default?: unknown;
  rest?: boolean;
}

export interface SimplifiedReturn {
  type: string;
  description?: string;
}

export interface SimplifiedSignature {
  parameters: SimplifiedParameter[];
  returns?: SimplifiedReturn;
  description?: string;
  typeParameters?: string[];
}

export interface SimplifiedMember {
  name: string;
  kind: 'property' | 'method';
  type?: string;
  description?: string;
  visibility?: 'public' | 'protected' | 'private';
  signature?: SimplifiedSignature;
}

export interface SimplifiedExample {
  code: string;
  title?: string;
  description?: string;
  language?: string;
}

export interface SimplifiedExport {
  id: string;
  name: string;
  kind: SpecExportKind;
  signature: string;
  description?: string;
  deprecated: boolean;
  tags: Array<{ name: string; text: string }>;
  parameters?: SimplifiedParameter[];
  returns?: SimplifiedReturn;
  members?: SimplifiedMember[];
  examples?: SimplifiedExample[];
  extends?: string;
  implements?: string[];
  sourceFile?: string;
  sourceLine?: number;
}

export interface SimplifiedSpec {
  name: string;
  version?: string;
  description?: string;
  exports: SimplifiedExport[];
  byKind: Record<SpecExportKind, SimplifiedExport[]>;
  totalExports: number;
}

/**
 * Simplify signature for JSON output.
 */
function simplifySignature(sig: SpecSignature | undefined): SimplifiedSignature | undefined {
  if (!sig) return undefined;

  return {
    parameters: (sig.parameters || []).map((p) => ({
      name: p.name,
      type: formatSchema(p.schema),
      required: p.required !== false,
      description: p.description,
      default: p.default,
      rest: p.rest,
    })),
    returns: sig.returns
      ? {
          type: formatSchema(sig.returns.schema),
          description: sig.returns.description,
        }
      : undefined,
    description: sig.description,
    typeParameters: sig.typeParameters?.map(
      (tp) => `${tp.name}${tp.constraint ? ` extends ${tp.constraint}` : ''}`,
    ),
  };
}

/**
 * Simplify member for JSON output.
 */
function simplifyMember(member: SpecMember): SimplifiedMember {
  const isMethod = !!member.signatures?.length;

  return {
    name: member.name || '',
    kind: isMethod ? 'method' : 'property',
    type: isMethod ? undefined : formatSchema(member.schema),
    description: member.description,
    visibility: member.visibility || 'public',
    signature: isMethod ? simplifySignature(member.signatures?.[0]) : undefined,
  };
}

/**
 * Simplify example for JSON output.
 */
function simplifyExample(example: string | SpecExample): SimplifiedExample {
  if (typeof example === 'string') {
    return { code: example, language: 'ts' };
  }
  return {
    code: example.code,
    title: example.title,
    description: example.description,
    language: example.language || 'ts',
  };
}

/**
 * Simplify an export for JSON output.
 */
function simplifyExport(exp: SpecExport): SimplifiedExport {
  const primarySig = exp.signatures?.[0];
  const simplified: SimplifiedExport = {
    id: exp.id,
    name: exp.name,
    kind: exp.kind,
    signature: buildSignatureString(exp),
    description: exp.description,
    deprecated: exp.deprecated === true,
    tags: (exp.tags || []).map((t) => ({ name: t.name, text: t.text })),
    extends: exp.extends,
    implements: exp.implements,
    sourceFile: exp.source?.file,
    sourceLine: exp.source?.line,
  };

  // Add kind-specific data
  switch (exp.kind) {
    case 'function':
      if (primarySig) {
        const sigData = simplifySignature(primarySig);
        simplified.parameters = sigData?.parameters;
        simplified.returns = sigData?.returns;
      }
      break;

    case 'class':
    case 'interface':
      if (exp.members?.length) {
        simplified.members = exp.members.map(simplifyMember);
      }
      break;

    case 'enum':
      if (exp.members?.length) {
        simplified.members = exp.members.map((m) => ({
          name: m.name || '',
          kind: 'property' as const,
          description: m.description,
          visibility: 'public' as const,
        }));
      }
      break;
  }

  // Add examples
  if (exp.examples?.length) {
    simplified.examples = exp.examples.map(simplifyExample);
  }

  return simplified;
}

/**
 * Render spec to simplified JSON structure.
 *
 * @param spec - The OpenPkg spec to simplify
 * @param options - JSON rendering options
 * @returns Simplified spec or single export structure
 *
 * @example
 * ```ts
 * import { createDocs } from '@openpkg-ts/doc-generator'
 *
 * const docs = createDocs('./openpkg.json')
 *
 * // Full spec as simplified JSON
 * const json = docs.toJSON()
 * // { name, version, exports: [...], byKind: {...} }
 *
 * // Single export
 * const fnJson = docs.toJSON({ export: 'greet' })
 * // { id, name, kind, signature, parameters, returns, ... }
 * ```
 */
export function toJSON(
  spec: OpenPkg,
  options: JSONOptions = {},
): SimplifiedSpec | SimplifiedExport {
  // Single export mode
  if (options.export) {
    const exp = spec.exports.find((e) => e.name === options.export || e.id === options.export);
    if (!exp) {
      throw new Error(`Export not found: ${options.export}`);
    }
    return simplifyExport(exp);
  }

  // Full spec mode
  const exports = spec.exports.map(simplifyExport);

  // Group by kind
  const byKind = {} as Record<SpecExportKind, SimplifiedExport[]>;
  for (const exp of exports) {
    if (!byKind[exp.kind]) byKind[exp.kind] = [];
    byKind[exp.kind].push(exp);
  }

  return {
    name: spec.meta.name,
    version: spec.meta.version,
    description: spec.meta.description,
    exports,
    byKind,
    totalExports: exports.length,
  };
}

/**
 * Serialize to JSON string with formatting.
 *
 * @param spec - The OpenPkg spec to serialize
 * @param options - JSON options plus pretty formatting option
 * @returns JSON string
 */
export function toJSONString(
  spec: OpenPkg,
  options: JSONOptions & { pretty?: boolean } = {},
): string {
  const data = toJSON(spec, options);
  return options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}
