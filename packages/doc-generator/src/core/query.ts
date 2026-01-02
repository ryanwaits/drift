import type {
  OpenPkg,
  SpecExport,
  SpecMember,
  SpecSchema,
  SpecSignature,
  SpecType,
  SpecTypeParameter,
} from '@openpkg-ts/spec';

/**
 * Format a schema to a human-readable type string.
 *
 * @param schema - The schema to format
 * @returns Formatted type string
 *
 * @example
 * ```ts
 * formatSchema({ type: 'string' }) // 'string'
 * formatSchema({ $ref: '#/types/User' }) // 'User'
 * formatSchema({ anyOf: [{ type: 'string' }, { type: 'number' }] }) // 'string | number'
 * ```
 */
export function formatSchema(schema: SpecSchema | undefined): string {
  if (!schema) return 'unknown';
  if (typeof schema === 'string') return schema;

  if (typeof schema === 'object' && schema !== null) {
    // Handle $ref
    if ('$ref' in schema && typeof schema.$ref === 'string') {
      return schema.$ref.replace('#/types/', '');
    }

    // Handle anyOf (union)
    if ('anyOf' in schema && Array.isArray(schema.anyOf)) {
      return schema.anyOf.map((s) => formatSchema(s)).join(' | ');
    }

    // Handle allOf (intersection)
    if ('allOf' in schema && Array.isArray(schema.allOf)) {
      return schema.allOf.map((s) => formatSchema(s)).join(' & ');
    }

    // Handle array
    if ('type' in schema && schema.type === 'array') {
      const items = 'items' in schema ? formatSchema(schema.items as SpecSchema) : 'unknown';
      return `${items}[]`;
    }

    // Handle tuple
    if ('type' in schema && schema.type === 'tuple' && 'items' in schema) {
      const items = (schema.items as SpecSchema[]).map(formatSchema).join(', ');
      return `[${items}]`;
    }

    // Handle object
    if ('type' in schema && schema.type === 'object') {
      if ('properties' in schema && schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([k, v]) => `${k}: ${formatSchema(v as SpecSchema)}`)
          .join('; ');
        return `{ ${props} }`;
      }
      return 'object';
    }

    // Handle basic type
    if ('type' in schema && typeof schema.type === 'string') {
      return schema.type;
    }
  }

  return 'unknown';
}

/**
 * Format type parameters to a string like `<T, U extends string>`.
 *
 * @param typeParams - Array of type parameters
 * @returns Formatted type parameters string or empty string
 *
 * @example
 * ```ts
 * formatTypeParameters([{ name: 'T' }]) // '<T>'
 * formatTypeParameters([{ name: 'T', constraint: 'object' }]) // '<T extends object>'
 * formatTypeParameters([{ name: 'T', default: 'unknown' }]) // '<T = unknown>'
 * ```
 */
export function formatTypeParameters(typeParams?: SpecTypeParameter[]): string {
  if (!typeParams?.length) return '';
  const params = typeParams.map((tp) => {
    let str = tp.name;
    if (tp.constraint) str += ` extends ${tp.constraint}`;
    if (tp.default) str += ` = ${tp.default}`;
    return str;
  });
  return `<${params.join(', ')}>`;
}

/**
 * Format function parameters to a string like `(a: string, b?: number)`.
 *
 * @param sig - The signature containing parameters
 * @returns Formatted parameters string
 *
 * @example
 * ```ts
 * formatParameters({ parameters: [{ name: 'id', schema: { type: 'string' } }] })
 * // '(id: string)'
 * ```
 */
export function formatParameters(sig?: SpecSignature): string {
  if (!sig?.parameters?.length) return '()';
  const params = sig.parameters.map((p) => {
    const optional = p.required === false ? '?' : '';
    const rest = p.rest ? '...' : '';
    const type = formatSchema(p.schema);
    return `${rest}${p.name}${optional}: ${type}`;
  });
  return `(${params.join(', ')})`;
}

/**
 * Format return type from signature.
 *
 * @param sig - The signature containing return type
 * @returns Formatted return type string
 *
 * @example
 * ```ts
 * formatReturnType({ returns: { schema: { type: 'Promise', items: { type: 'string' } } } })
 * // 'Promise<string>'
 * ```
 */
export function formatReturnType(sig?: SpecSignature): string {
  if (!sig?.returns) return 'void';
  return formatSchema(sig.returns.schema);
}

/**
 * Build a full signature string for an export.
 *
 * @param exp - The export to build a signature for
 * @param sigIndex - Index of signature to use for overloaded functions
 * @returns Complete signature string
 *
 * @example
 * ```ts
 * buildSignatureString({ kind: 'function', name: 'greet', signatures: [...] })
 * // 'function greet(name: string): string'
 *
 * buildSignatureString({ kind: 'class', name: 'Logger', extends: 'EventEmitter' })
 * // 'class Logger extends EventEmitter'
 * ```
 */
export function buildSignatureString(exp: SpecExport, sigIndex = 0): string {
  const sig = exp.signatures?.[sigIndex];
  const typeParams = formatTypeParameters(exp.typeParameters || sig?.typeParameters);

  switch (exp.kind) {
    case 'function': {
      const params = formatParameters(sig);
      const returnType = formatReturnType(sig);
      return `function ${exp.name}${typeParams}${params}: ${returnType}`;
    }
    case 'class': {
      const ext = exp.extends ? ` extends ${exp.extends}` : '';
      const impl = exp.implements?.length ? ` implements ${exp.implements.join(', ')}` : '';
      return `class ${exp.name}${typeParams}${ext}${impl}`;
    }
    case 'interface': {
      const ext = exp.extends ? ` extends ${exp.extends}` : '';
      return `interface ${exp.name}${typeParams}${ext}`;
    }
    case 'type': {
      const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);
      return `type ${exp.name}${typeParams} = ${typeValue}`;
    }
    case 'enum': {
      return `enum ${exp.name}`;
    }
    case 'variable': {
      const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);
      return `const ${exp.name}: ${typeValue}`;
    }
    default:
      return exp.name;
  }
}

/**
 * Resolve a type reference to its definition.
 *
 * @param ref - Type reference string (e.g., '#/types/User')
 * @param spec - The OpenPkg spec containing type definitions
 * @returns The resolved type definition or undefined
 *
 * @example
 * ```ts
 * resolveTypeRef('#/types/User', spec)
 * // { id: 'User', name: 'User', kind: 'interface', ... }
 * ```
 */
export function resolveTypeRef(ref: string, spec: OpenPkg): SpecType | undefined {
  const id = ref.replace('#/types/', '');
  return spec.types?.find((t) => t.id === id);
}

/**
 * Check if a member is a method (has signatures).
 *
 * @param member - The member to check
 * @returns True if the member is a method
 *
 * @example
 * ```ts
 * isMethod({ name: 'foo', signatures: [{ parameters: [] }] }) // true
 * isMethod({ name: 'bar', schema: { type: 'string' } }) // false
 * ```
 */
export function isMethod(member: SpecMember): boolean {
  return !!member.signatures?.length;
}

/**
 * Check if a member is a property (no signatures).
 *
 * @param member - The member to check
 * @returns True if the member is a property
 */
export function isProperty(member: SpecMember): boolean {
  return !member.signatures?.length;
}

/**
 * Get methods from members list.
 *
 * @param members - Array of members to filter
 * @returns Array of method members
 */
export function getMethods(members?: SpecMember[]): SpecMember[] {
  return members?.filter(isMethod) ?? [];
}

/**
 * Get properties from members list.
 *
 * @param members - Array of members to filter
 * @returns Array of property members
 */
export function getProperties(members?: SpecMember[]): SpecMember[] {
  return members?.filter(isProperty) ?? [];
}

/**
 * Group members by visibility (public, protected, private).
 *
 * @param members - Array of members to group
 * @returns Object with public, protected, and private arrays
 *
 * @example
 * ```ts
 * const groups = groupByVisibility(classExport.members)
 * groups.public  // [{ name: 'foo', visibility: 'public' }]
 * groups.private // [{ name: 'bar', visibility: 'private' }]
 * ```
 */
export function groupByVisibility(members?: SpecMember[]): {
  public: SpecMember[];
  protected: SpecMember[];
  private: SpecMember[];
} {
  const groups = {
    public: [] as SpecMember[],
    protected: [] as SpecMember[],
    private: [] as SpecMember[],
  };

  for (const member of members ?? []) {
    const visibility = member.visibility ?? 'public';
    groups[visibility].push(member);
  }

  return groups;
}

/**
 * Sort exports alphabetically by name.
 *
 * @param items - Array of items with a name property
 * @returns New sorted array
 */
export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}
