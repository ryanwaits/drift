import { c, indent, padRight } from '../utils/render';

interface SchemaLike {
  parameters?: Array<{ name: string; schema?: SchemaLike; required?: boolean }>;
  returns?: SchemaLike;
  properties?: Record<string, SchemaLike>;
  required?: string[];
  $ref?: string;
  type?: string;
  items?: SchemaLike;
  anyOf?: SchemaLike[];
  [key: string]: unknown;
}

interface GetData {
  export: {
    name: string;
    kind: string;
    description?: string;
    signature?: string;
    parameters?: Array<{ name: string; type?: string; required?: boolean; description?: string }>;
    returns?: { type?: string; description?: string };
    members?: Array<{ name: string; type?: string; required?: boolean; description?: string }>;
    deprecated?: boolean;
    schema?: SchemaLike;
  };
  types?: Record<string, SchemaLike>;
}

export function renderGet(data: GetData): string {
  const lines: string[] = [''];
  const exp = data.export;

  // Header
  lines.push(
    indent(
      `${c.bold(exp.name)}${' '.repeat(Math.max(2, 50 - exp.name.length))}${c.gray(exp.kind)}`,
    ),
  );

  if (exp.deprecated) {
    lines.push(indent(c.yellow('deprecated')));
  }

  if (exp.description) {
    lines.push(indent(c.dim(exp.description)));
  }

  lines.push('');

  // Signature
  if (exp.signature) {
    lines.push(indent(`  ${exp.signature}`));
    lines.push('');
  }

  // Parameters
  const params = exp.parameters ?? extractParams(exp.schema);
  if (params.length > 0) {
    lines.push(indent(c.gray('  PARAMETERS')));
    for (const p of params) {
      const req = p.required ? 'required' : 'optional';
      const type = p.type ?? 'unknown';
      const desc = p.description ? `  ${c.dim(JSON.stringify(p.description))}` : '';
      lines.push(indent(`  ${padRight(p.name, 16)}${padRight(type, 24)}${c.gray(req)}${desc}`));
    }
    lines.push('');
  }

  // Returns
  const returns = exp.returns ?? extractReturns(exp.schema);
  if (returns) {
    lines.push(indent(c.gray('  RETURNS')));
    lines.push(indent(`  ${returns.type ?? 'void'}`));
    lines.push('');
  }

  // Members (for classes/interfaces)
  const members = exp.members ?? extractMembers(exp.schema);
  if (members.length > 0) {
    const shown = members.slice(0, 50);
    const remaining = members.length - shown.length;

    lines.push(indent(c.gray('  MEMBERS')));
    for (const m of shown) {
      const req = m.required ? 'required' : 'optional';
      const type = m.type ?? '';
      lines.push(indent(`  ${padRight(m.name, 20)}${padRight(type, 20)}${c.gray(req)}`));
    }
    if (remaining > 0) {
      lines.push(indent(c.gray(`  ... ${remaining} more`)));
    }
    lines.push('');
  }

  // Inline referenced types
  if (data.types && Object.keys(data.types).length > 0) {
    for (const [typeName, typeSchema] of Object.entries(data.types)) {
      const props = extractPropsFromSchema(typeSchema);
      if (props.length > 0) {
        lines.push('');
        lines.push(
          indent(
            `  ${c.bold(typeName)}${' '.repeat(Math.max(2, 40 - typeName.length))}${c.gray('interface')}`,
          ),
        );
        lines.push(indent(`  ${'-'.repeat(typeName.length)}`));
        const shownProps = props.slice(0, 50);
        for (const p of shownProps) {
          lines.push(
            indent(
              `  ${padRight(p.name, 20)}${padRight(p.type, 20)}${c.gray(p.required ? 'required' : 'optional')}`,
            ),
          );
        }
        if (props.length > 50) {
          lines.push(indent(c.gray(`  ... ${props.length - 50} more`)));
        }
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

function extractParams(
  schema: SchemaLike | undefined,
): Array<{ name: string; type?: string; required?: boolean }> {
  if (!schema?.parameters) return [];
  return schema.parameters.map((p) => ({
    name: p.name,
    type: formatType(p.schema),
    required: p.required !== false,
  }));
}

function extractReturns(schema: SchemaLike | undefined): { type?: string } | null {
  if (!schema?.returns) return null;
  return { type: formatType(schema.returns) };
}

function extractMembers(
  schema: SchemaLike | undefined,
): Array<{ name: string; type?: string; required?: boolean }> {
  if (!schema?.properties) return [];
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([name, prop]: [string, SchemaLike]) => ({
    name,
    type: formatType(prop),
    required: required.has(name),
  }));
}

function extractPropsFromSchema(
  schema: SchemaLike | undefined,
): Array<{ name: string; type: string; required: boolean }> {
  if (!schema?.properties) return [];
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([name, prop]: [string, SchemaLike]) => ({
    name,
    type: formatType(prop),
    required: required.has(name),
  }));
}

function formatType(schema: SchemaLike | undefined): string {
  if (!schema) return 'unknown';
  if (schema.$ref) return schema.$ref.replace('#/types/', '');
  if (schema.type === 'array' && schema.items) return `${formatType(schema.items)}[]`;
  if (schema.anyOf) return schema.anyOf.map(formatType).join(' | ');
  if (schema.type) return schema.type;
  return 'unknown';
}
