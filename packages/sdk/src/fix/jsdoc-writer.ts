/**
 * JSDoc writer utility for parsing, patching, and writing JSDoc comments back to source files.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as TS from 'typescript';
import { ts } from '../ts-module';

/**
 * Represents a single parameter in a JSDoc patch
 */
export interface JSDocParam {
  name: string;
  type?: string;
  description?: string;
  optional?: boolean;
}

/**
 * Represents a return type in a JSDoc patch
 */
export interface JSDocReturn {
  type?: string;
  description?: string;
}

/**
 * Represents a generic tag in a JSDoc patch
 */
export interface JSDocTag {
  name: string;
  text: string;
}

/**
 * A patchable representation of a JSDoc comment
 */
/**
 * Represents a @throws tag in a JSDoc patch
 */
export interface JSDocThrows {
  type?: string;
  description?: string;
}

export interface JSDocPatch {
  description?: string;
  params?: JSDocParam[];
  returns?: JSDocReturn;
  throws?: JSDocThrows[];
  examples?: string[];
  deprecated?: string | false;
  async?: boolean;
  type?: string;
  typeParams?: Array<{ name: string; constraint?: string; description?: string }>;
  otherTags?: JSDocTag[];
}

/**
 * Represents an edit to be applied to a source file
 */
export interface JSDocEdit {
  filePath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  hasExisting: boolean;
  existingJSDoc?: string;
  newJSDoc: string;
  indent: string;
}

/**
 * Result of applying edits to source files
 */
export interface ApplyEditsResult {
  filesModified: number;
  editsApplied: number;
  errors: Array<{ file: string; error: string }>;
}

/**
 * Parse a JSDoc comment string into a patchable structure
 */
export function parseJSDocToPatch(jsDocText: string): JSDocPatch {
  const patch: JSDocPatch = {};

  // Remove comment delimiters and leading asterisks
  const cleanedText = jsDocText
    .replace(/^\/\*\*\s*/, '')
    .replace(/\s*\*\/$/, '')
    .replace(/^\s*\* ?/gm, '')
    .trim();

  const lines = cleanedText.split('\n');
  let currentTag = '';
  let currentContent: string[] = [];
  const descriptionLines: string[] = [];

  const processCurrentTag = () => {
    if (!currentTag) return;

    const content = currentContent.join('\n').trim();

    switch (currentTag) {
      case 'param':
      case 'parameter': {
        // Parse: {type} name - description OR {type} name description OR name description
        const paramMatch = content.match(
          /^(?:\{([^}]+)\}\s+)?(\[?\w+(?:\.\w+)*\]?)(?:\s+-\s+|\s+)?(.*)$/s,
        );
        if (paramMatch) {
          const [, type, rawName, description] = paramMatch;
          const optional = rawName.startsWith('[') && rawName.endsWith(']');
          const name = optional ? rawName.slice(1, -1) : rawName;

          if (!patch.params) patch.params = [];
          patch.params.push({
            name,
            type: type?.trim(),
            description: description?.trim(),
            optional,
          });
        }
        break;
      }
      case 'returns':
      case 'return': {
        const returnMatch = content.match(/^(?:\{([^}]+)\}\s*)?(.*)$/s);
        if (returnMatch) {
          patch.returns = {
            type: returnMatch[1]?.trim(),
            description: returnMatch[2]?.trim(),
          };
        }
        break;
      }
      case 'example': {
        if (!patch.examples) patch.examples = [];
        patch.examples.push(content);
        break;
      }
      case 'deprecated': {
        patch.deprecated = content || 'Deprecated';
        break;
      }
      case 'throws':
      case 'throw': {
        // Parse: {@link Error} description OR {Error} description OR just description
        if (!patch.throws) patch.throws = [];
        const throwsMatch = content.match(/^(?:\{@?link\s+([^}]+)\}|\{([^}]+)\})?\s*(.*)$/s);
        if (throwsMatch) {
          patch.throws.push({
            type: (throwsMatch[1] || throwsMatch[2])?.trim(),
            description: throwsMatch[3]?.trim(),
          });
        } else {
          patch.throws.push({ description: content.trim() });
        }
        break;
      }
      case 'async': {
        patch.async = true;
        break;
      }
      case 'type': {
        // Parse: {type}
        const typeMatch = content.match(/^\{([^}]+)\}$/);
        if (typeMatch) {
          patch.type = typeMatch[1].trim();
        } else if (content.trim()) {
          patch.type = content.trim();
        }
        break;
      }
      case 'template': {
        // Parse: T, T extends Foo, T - description
        const templateMatch = content.match(/^(\w+)(?:\s+extends\s+(\S+))?(?:\s+-?\s*(.*))?$/);
        if (templateMatch) {
          if (!patch.typeParams) patch.typeParams = [];
          patch.typeParams.push({
            name: templateMatch[1],
            constraint: templateMatch[2],
            description: templateMatch[3]?.trim(),
          });
        }
        break;
      }
      default: {
        if (!patch.otherTags) patch.otherTags = [];
        patch.otherTags.push({ name: currentTag, text: content });
      }
    }
  };

  for (const line of lines) {
    const tagMatch = line.match(/^@(\w+)(?:\s+(.*))?$/);

    if (tagMatch) {
      processCurrentTag();
      currentTag = tagMatch[1];
      currentContent = tagMatch[2] ? [tagMatch[2]] : [];
    } else if (currentTag) {
      currentContent.push(line);
    } else if (line.trim()) {
      descriptionLines.push(line);
    }
  }

  processCurrentTag();

  if (descriptionLines.length > 0) {
    patch.description = descriptionLines.join('\n').trim();
  }

  return patch;
}

/**
 * Apply a partial patch to an existing JSDoc patch, preserving unmodified content
 */
export function applyPatchToJSDoc(existing: JSDocPatch, updates: Partial<JSDocPatch>): JSDocPatch {
  const result: JSDocPatch = { ...existing };

  if (updates.description !== undefined) {
    result.description = updates.description;
  }

  if (updates.params !== undefined) {
    // Merge params by name, preserving existing descriptions if not updated
    const existingByName = new Map(existing.params?.map((p) => [p.name, p]) ?? []);
    result.params = updates.params.map((updatedParam) => {
      const existingParam = existingByName.get(updatedParam.name);
      return {
        ...existingParam,
        ...updatedParam,
        // Keep existing description if update doesn't provide one
        description: updatedParam.description ?? existingParam?.description,
      };
    });
  }

  if (updates.returns !== undefined) {
    result.returns = {
      ...existing.returns,
      ...updates.returns,
    };
  }

  if (updates.throws !== undefined) {
    result.throws = updates.throws;
  }

  if (updates.examples !== undefined) {
    result.examples = updates.examples;
  }

  if (updates.deprecated !== undefined) {
    result.deprecated = updates.deprecated;
  }

  if (updates.typeParams !== undefined) {
    result.typeParams = updates.typeParams;
  }

  if (updates.otherTags !== undefined) {
    result.otherTags = updates.otherTags;
  }

  return result;
}

/**
 * Serialize a JSDocPatch back to a formatted comment string
 */
export function serializeJSDoc(patch: JSDocPatch, indent = ''): string {
  const lines: string[] = [];

  // Description
  if (patch.description) {
    const descLines = patch.description.split('\n');
    for (const line of descLines) {
      lines.push(line);
    }
  }

  // Add blank line between description and tags if both exist
  const hasTags =
    patch.params?.length ||
    patch.returns ||
    patch.throws?.length ||
    patch.examples?.length ||
    patch.deprecated ||
    patch.async ||
    patch.type ||
    patch.typeParams?.length ||
    patch.otherTags?.length;

  if (patch.description && hasTags) {
    lines.push('');
  }

  // Async tag
  if (patch.async) {
    lines.push('@async');
  }

  // Type tag (for properties/variables)
  if (patch.type) {
    lines.push(`@type {${patch.type}}`);
  }

  // Type parameters (@template)
  if (patch.typeParams) {
    for (const tp of patch.typeParams) {
      let tagLine = `@template ${tp.name}`;
      if (tp.constraint) {
        tagLine += ` extends ${tp.constraint}`;
      }
      if (tp.description) {
        tagLine += ` - ${tp.description}`;
      }
      lines.push(tagLine);
    }
  }

  // Parameters
  if (patch.params) {
    for (const param of patch.params) {
      let tagLine = '@param';
      if (param.type) {
        tagLine += ` {${param.type}}`;
      }
      const paramName = param.optional ? `[${param.name}]` : param.name;
      tagLine += ` ${paramName}`;
      if (param.description) {
        tagLine += ` - ${param.description}`;
      }
      lines.push(tagLine);
    }
  }

  // Returns
  if (patch.returns && (patch.returns.type || patch.returns.description)) {
    let tagLine = '@returns';
    if (patch.returns.type) {
      tagLine += ` {${patch.returns.type}}`;
    }
    if (patch.returns.description) {
      tagLine += ` ${patch.returns.description}`;
    }
    lines.push(tagLine);
  }

  // Throws (one block per exception type per TSDoc)
  if (patch.throws) {
    for (const t of patch.throws) {
      let tagLine = '@throws';
      if (t.type) {
        tagLine += ` {${t.type}}`;
      }
      if (t.description) {
        tagLine += ` ${t.description}`;
      }
      lines.push(tagLine);
    }
  }

  // Deprecated (only if truthy string, not false)
  if (patch.deprecated && typeof patch.deprecated === 'string') {
    lines.push(`@deprecated ${patch.deprecated}`);
  }

  // Examples
  if (patch.examples) {
    for (const example of patch.examples) {
      lines.push('@example');
      // Indent example content
      const exampleLines = example.split('\n');
      for (const line of exampleLines) {
        lines.push(line);
      }
    }
  }

  // Other tags
  if (patch.otherTags) {
    for (const tag of patch.otherTags) {
      if (tag.text) {
        lines.push(`@${tag.name} ${tag.text}`);
      } else {
        lines.push(`@${tag.name}`);
      }
    }
  }

  // Format as JSDoc comment
  if (lines.length === 0) {
    return `${indent}/** */`;
  }

  if (lines.length === 1 && lines[0].length < 60) {
    return `${indent}/** ${lines[0]} */`;
  }

  const formattedLines = lines.map((line) => `${indent} * ${line}`);
  return `${indent}/**\n${formattedLines.join('\n')}\n${indent} */`;
}

/**
 * Find the JSDoc location for a declaration in a source file
 */
export function findJSDocLocation(
  sourceFile: TS.SourceFile,
  symbolName: string,
  approximateLine?: number,
): {
  startLine: number;
  endLine: number;
  declarationLine: number;
  hasExisting: boolean;
  existingJSDoc?: string;
  indent: string;
} | null {
  let result: ReturnType<typeof findJSDocLocation> = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  function getIndent(node: TS.Node): string {
    const pos = node.getStart(sourceFile);
    const { character } = sourceFile.getLineAndCharacterOfPosition(pos);
    return ' '.repeat(character);
  }

  function processNode(node: TS.Node, name: string | undefined) {
    if (name !== symbolName) return;

    const { line: nodeLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

    // If approximate line given, prefer closest match
    if (approximateLine !== undefined) {
      const distance = Math.abs(nodeLine - approximateLine);
      if (distance >= closestDistance) return;
      closestDistance = distance;
    }

    const indent = getIndent(node);

    // Check for existing JSDoc
    const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, node.pos);
    let jsDocRange: TS.CommentRange | undefined;

    if (commentRanges) {
      for (let i = commentRanges.length - 1; i >= 0; i--) {
        const range = commentRanges[i];
        const text = sourceFile.text.substring(range.pos, range.end);
        if (text.startsWith('/**')) {
          jsDocRange = range;
          break;
        }
      }
    }

    if (jsDocRange) {
      const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(jsDocRange.pos);
      const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(jsDocRange.end);
      const existingJSDoc = sourceFile.text.substring(jsDocRange.pos, jsDocRange.end);

      result = {
        startLine,
        endLine,
        declarationLine: nodeLine,
        hasExisting: true,
        existingJSDoc,
        indent,
      };
    } else {
      result = {
        startLine: nodeLine,
        endLine: nodeLine,
        declarationLine: nodeLine,
        hasExisting: false,
        indent,
      };
    }
  }

  function visit(node: TS.Node) {
    // Function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      processNode(node, node.name.getText(sourceFile));
    }

    // Variable declarations (for arrow functions and const exports)
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          processNode(node, decl.name.getText(sourceFile));
        }
      }
    }

    // Class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      processNode(node, node.name.getText(sourceFile));
    }

    // Interface declarations
    if (ts.isInterfaceDeclaration(node)) {
      processNode(node, node.name.getText(sourceFile));
    }

    // Type alias declarations
    if (ts.isTypeAliasDeclaration(node)) {
      processNode(node, node.name.getText(sourceFile));
    }

    // Method declarations (within classes)
    if (ts.isMethodDeclaration(node) && node.name) {
      processNode(node, node.name.getText(sourceFile));
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

/**
 * Apply a batch of edits to source files
 */
export async function applyEdits(edits: JSDocEdit[]): Promise<ApplyEditsResult> {
  const result: ApplyEditsResult = {
    filesModified: 0,
    editsApplied: 0,
    errors: [],
  };

  // Group edits by file
  const editsByFile = new Map<string, JSDocEdit[]>();
  for (const edit of edits) {
    const existing = editsByFile.get(edit.filePath) ?? [];
    existing.push(edit);
    editsByFile.set(edit.filePath, existing);
  }

  for (const [filePath, fileEdits] of editsByFile) {
    try {
      // Read file content
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Sort edits by line number descending (so we can apply from bottom to top)
      const sortedEdits = [...fileEdits].sort((a, b) => b.startLine - a.startLine);

      for (const edit of sortedEdits) {
        const newJSDocLines = edit.newJSDoc.split('\n');

        if (edit.hasExisting) {
          // Replace existing JSDoc
          lines.splice(edit.startLine, edit.endLine - edit.startLine + 1, ...newJSDocLines);
        } else {
          // Insert new JSDoc before declaration
          lines.splice(edit.startLine, 0, ...newJSDocLines);
        }

        result.editsApplied++;
      }

      // Write file back
      fs.writeFileSync(filePath, lines.join('\n'));
      result.filesModified++;
    } catch (error) {
      result.errors.push({
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * Create a TypeScript source file from a file path
 */
export function createSourceFile(filePath: string): TS.SourceFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  return ts.createSourceFile(
    path.basename(filePath),
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}
