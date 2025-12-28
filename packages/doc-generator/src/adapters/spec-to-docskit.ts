/**
 * Adapters to convert OpenPkg spec types to DocsKit API component props.
 * Bridges the gap between SpecExport data and the new Stripe-style API components.
 */

import type {
  OpenPkg,
  SpecExample,
  SpecExport,
  SpecSchema,
  SpecSignatureParameter,
} from '@openpkg-ts/spec';
import type {
  APIParameterSchema,
  CodeExample,
  Language,
} from '@doccov/ui/docskit';
import { formatSchema } from '../core/query';

/**
 * Convert SpecSchema to APIParameterSchema for nested object display.
 */
export function specSchemaToAPISchema(schema: SpecSchema | undefined): APIParameterSchema | undefined {
  if (!schema || typeof schema !== 'object') return undefined;

  const s = schema as Record<string, unknown>;
  const result: APIParameterSchema = {};

  // Type string
  result.type = formatSchema(schema);
  result.typeString = result.type;

  // Description
  if (typeof s.description === 'string') {
    result.description = s.description;
  }

  // Nested properties for objects
  if (s.type === 'object' && s.properties && typeof s.properties === 'object') {
    result.properties = {};
    for (const [key, value] of Object.entries(s.properties)) {
      const nestedSchema = specSchemaToAPISchema(value as SpecSchema);
      if (nestedSchema) {
        result.properties[key] = nestedSchema;
      }
    }

    // Required fields
    if (Array.isArray(s.required)) {
      result.required = s.required as string[];
    }
  }

  return result;
}

/**
 * Convert a SpecSignatureParameter to APIParameterItem props.
 */
export function specParamToAPIParam(param: SpecSignatureParameter): {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  children?: APIParameterSchema;
} {
  const type = formatSchema(param.schema);
  const children = specSchemaToAPISchema(param.schema);
  const hasNestedProperties = children?.properties && Object.keys(children.properties).length > 0;

  return {
    name: param.name ?? 'unknown',
    type,
    required: param.required !== false,
    description: param.description,
    children: hasNestedProperties ? children : undefined,
  };
}

/**
 * Convert SpecExample[] to CodeExample[] for APICodePanel.
 */
export function specExamplesToCodeExamples(
  examples: SpecExample[] | undefined,
  defaultLang = 'typescript',
): CodeExample[] {
  if (!examples?.length) return [];

  return examples.map((example) => {
    if (typeof example === 'string') {
      return {
        languageId: defaultLang,
        code: example,
        highlightLang: getLangForHighlight(defaultLang),
      };
    }
    return {
      languageId: example.language || defaultLang,
      code: example.code,
      highlightLang: getLangForHighlight(example.language || defaultLang),
    };
  });
}

/**
 * Map language identifiers to highlight.js/shiki language names.
 */
function getLangForHighlight(lang: string): string {
  const langMap: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    ts: 'ts',
    js: 'js',
    tsx: 'tsx',
    jsx: 'jsx',
    bash: 'bash',
    shell: 'bash',
    sh: 'bash',
    curl: 'bash',
    json: 'json',
    python: 'python',
    py: 'python',
    go: 'go',
    rust: 'rust',
    ruby: 'ruby',
  };
  return langMap[lang.toLowerCase()] || lang;
}

/**
 * Extract unique languages from examples for language selector.
 */
export function getLanguagesFromExamples(examples: SpecExample[] | undefined): Language[] {
  if (!examples?.length) return [];

  const langSet = new Set<string>();
  const languages: Language[] = [];

  for (const example of examples) {
    const lang = typeof example === 'string' ? 'typescript' : (example.language || 'typescript');
    if (!langSet.has(lang)) {
      langSet.add(lang);
      languages.push({
        id: lang,
        label: getLanguageLabel(lang),
      });
    }
  }

  return languages;
}

/**
 * Get display label for a language.
 */
function getLanguageLabel(lang: string): string {
  const labels: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    js: 'JavaScript',
    tsx: 'TSX',
    jsx: 'JSX',
    bash: 'Bash',
    shell: 'Shell',
    sh: 'Shell',
    curl: 'cURL',
    json: 'JSON',
    python: 'Python',
    py: 'Python',
    go: 'Go',
    rust: 'Rust',
    ruby: 'Ruby',
    node: 'Node.js',
  };
  return labels[lang.toLowerCase()] || lang;
}

/**
 * Build import statement for an export.
 */
export function buildImportStatement(exp: SpecExport, spec: OpenPkg): string {
  const packageName = spec.meta?.name || 'package';

  // Check for custom import path in extensions
  const presentation = spec.extensions?.presentation?.[exp.id];
  const importPath = presentation?.importPath || packageName;
  const alias = presentation?.alias || exp.name;

  if (exp.kind === 'type' || exp.kind === 'interface') {
    return `import type { ${alias} } from '${importPath}'`;
  }
  return `import { ${alias} } from '${importPath}'`;
}

