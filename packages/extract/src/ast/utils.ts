import type {
  SpecExample,
  SpecExampleLanguage,
  SpecSource,
  SpecTag,
  SpecTypeParameter,
} from '@openpkg-ts/spec';
import ts from 'typescript';

/**
 * Parse @example tags into SpecExample objects.
 * Handles markdown code fences and extracts language.
 */
function parseExamplesFromTags(tags: SpecTag[]): SpecExample[] {
  const examples: SpecExample[] = [];

  for (const tag of tags) {
    if (tag.name !== 'example') continue;

    const text = tag.text.trim();
    // Match code fence: ```lang\ncode\n``` or ```\ncode\n```
    const fenceMatch = text.match(/^```(\w*)\n([\s\S]*?)\n?```$/);

    if (fenceMatch) {
      const lang = fenceMatch[1] || undefined;
      const code = fenceMatch[2].trim();
      const example: SpecExample = { code };
      if (lang && ['ts', 'js', 'tsx', 'jsx', 'shell', 'json'].includes(lang)) {
        example.language = lang as SpecExampleLanguage;
      }
      examples.push(example);
    } else if (text) {
      // No code fence, use raw text
      examples.push({ code: text });
    }
  }

  return examples;
}

export function getJSDocComment(node: ts.Node): {
  description?: string;
  tags: SpecTag[];
  examples: SpecExample[];
} {
  const jsDocTags = ts.getJSDocTags(node);
  const tags: SpecTag[] = jsDocTags.map((tag) => ({
    name: tag.tagName.text,
    text:
      typeof tag.comment === 'string' ? tag.comment : (ts.getTextOfJSDocComment(tag.comment) ?? ''),
  }));

  // Get description from first JSDoc comment
  const jsDocComments = (node as ts.HasJSDoc).jsDoc;
  let description: string | undefined;
  if (jsDocComments && jsDocComments.length > 0) {
    const firstDoc = jsDocComments[0];
    if (firstDoc.comment) {
      description =
        typeof firstDoc.comment === 'string'
          ? firstDoc.comment
          : ts.getTextOfJSDocComment(firstDoc.comment);
    }
  }

  // Parse @example tags into examples array
  const examples = parseExamplesFromTags(tags);

  return { description, tags, examples };
}

export function getSourceLocation(node: ts.Node, sourceFile: ts.SourceFile): SpecSource {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    file: sourceFile.fileName,
    line: line + 1,
  };
}

/**
 * Get description for a destructured parameter property from JSDoc @param tags.
 * Matches patterns like:
 * - @param paramName - exact match
 * - @param opts.paramName - dotted notation with alias
 * - @param {type} paramName - type annotation format
 */
export function getParamDescription(
  propertyName: string,
  jsdocTags: readonly ts.JSDocTag[],
  inferredAlias?: string,
): string | undefined {
  for (const tag of jsdocTags) {
    if (tag.tagName.text !== 'param') continue;

    const paramTag = tag as ts.JSDocParameterTag;
    const tagParamName = paramTag.name?.getText() ?? '';

    // Try matching strategies:
    // 1. Exact match: @param propertyName
    // 2. With alias: @param alias.propertyName
    // 3. Any dotted ending: @param *.propertyName (fallback for __0 cases)
    const isMatch =
      tagParamName === propertyName ||
      (inferredAlias && tagParamName === `${inferredAlias}.${propertyName}`) ||
      tagParamName.endsWith(`.${propertyName}`);

    if (isMatch) {
      const comment =
        typeof tag.comment === 'string' ? tag.comment : ts.getTextOfJSDocComment(tag.comment);
      return comment?.trim() || undefined;
    }
  }

  return undefined;
}

type DeclarationWithTypeParams =
  | ts.FunctionDeclaration
  | ts.ClassDeclaration
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.MethodDeclaration
  | ts.ArrowFunction;

/**
 * Extract type parameters from declarations like `<T extends Base, K = Default>`
 */
export function extractTypeParameters(
  node: DeclarationWithTypeParams,
  checker: ts.TypeChecker,
): SpecTypeParameter[] | undefined {
  if (!node.typeParameters || node.typeParameters.length === 0) {
    return undefined;
  }

  return node.typeParameters.map((tp) => {
    const name = tp.name.text;

    // Get constraint (T extends SomeType)
    let constraint: string | undefined;
    if (tp.constraint) {
      const constraintType = checker.getTypeAtLocation(tp.constraint);
      constraint = checker.typeToString(constraintType);
    }

    // Get default (T = DefaultType)
    let defaultType: string | undefined;
    if (tp.default) {
      const defType = checker.getTypeAtLocation(tp.default);
      defaultType = checker.typeToString(defType);
    }

    return {
      name,
      ...(constraint ? { constraint } : {}),
      ...(defaultType ? { default: defaultType } : {}),
    };
  });
}
