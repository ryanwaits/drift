import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { SCHEMA_VERSION } from '@openpkg-ts/spec';
import ts from 'typescript';
import { createProgram } from '../compiler/program';
import { serializeClass } from '../serializers/classes';
import { createContext, type SerializerContext } from '../serializers/context';
import { serializeEnum } from '../serializers/enums';
import { serializeFunctionExport } from '../serializers/functions';
import { serializeInterface } from '../serializers/interfaces';
import { serializeTypeAlias } from '../serializers/type-aliases';
import { serializeVariable } from '../serializers/variables';
import type { Diagnostic, ExtractOptions, ExtractResult } from '../types';

export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  const { entryFile, baseDir, content, maxTypeDepth, maxExternalTypeDepth, resolveExternalTypes } = options;

  const diagnostics: Diagnostic[] = [];
  const exports: SpecExport[] = [];

  // Create program
  const result = createProgram({ entryFile, baseDir, content });
  const { program, sourceFile } = result;

  if (!sourceFile) {
    return {
      spec: createEmptySpec(entryFile),
      diagnostics: [{ message: `Could not load source file: ${entryFile}`, severity: 'error' }],
    };
  }

  const typeChecker = program.getTypeChecker();

  // Get module symbol and its exports (handles re-exports properly)
  const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return {
      spec: createEmptySpec(entryFile),
      diagnostics: [{ message: 'Could not get module symbol', severity: 'warning' }],
    };
  }

  const exportedSymbols = typeChecker.getExportsOfModule(moduleSymbol);

  // First pass: collect all export names so we can skip them when registering types
  const exportedIds = new Set<string>();
  for (const symbol of exportedSymbols) {
    exportedIds.add(symbol.getName());
  }

  const ctx = createContext(program, sourceFile, { maxTypeDepth, maxExternalTypeDepth, resolveExternalTypes });
  ctx.exportedIds = exportedIds;

  for (const symbol of exportedSymbols) {
    try {
      const { declaration, targetSymbol } = resolveExportTarget(symbol, typeChecker);
      if (!declaration) continue;

      const exportName = symbol.getName();
      // Pass both original symbol (for JSDoc on export) and target symbol
      const exp = serializeDeclaration(declaration, symbol, targetSymbol, exportName, ctx);
      if (exp) exports.push(exp);
    } catch (err) {
      diagnostics.push({
        message: `Failed to serialize ${symbol.getName()}: ${err}`,
        severity: 'warning',
      });
    }
  }

  // Get package metadata
  const meta = await getPackageMeta(entryFile, baseDir);

  const spec: OpenPkg = {
    openpkg: SCHEMA_VERSION,
    meta,
    exports,
    types: ctx.typeRegistry.getAll(),
    generation: {
      generator: '@openpkg-ts/extract',
      timestamp: new Date().toISOString(),
    },
  };

  return { spec, diagnostics };
}

/**
 * Follows export aliases back to the declaration that carries the type info.
 */
function resolveExportTarget(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): { declaration?: ts.Declaration; targetSymbol: ts.Symbol } {
  let targetSymbol = symbol;

  // Use getAliasedSymbol to follow the full alias chain (handles re-exports)
  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliasTarget = checker.getAliasedSymbol(symbol);
    if (aliasTarget && aliasTarget !== symbol) {
      targetSymbol = aliasTarget;
    }
  }

  const declarations = targetSymbol.declarations ?? [];
  const declaration =
    targetSymbol.valueDeclaration ||
    declarations.find((decl) => decl.kind !== ts.SyntaxKind.ExportSpecifier) ||
    declarations[0];

  return { declaration, targetSymbol };
}

function serializeDeclaration(
  declaration: ts.Declaration,
  exportSymbol: ts.Symbol,
  targetSymbol: ts.Symbol,
  exportName: string,
  ctx: SerializerContext,
): SpecExport | null {
  let result: SpecExport | null = null;

  if (ts.isFunctionDeclaration(declaration)) {
    result = serializeFunctionExport(declaration, ctx);
  } else if (ts.isClassDeclaration(declaration)) {
    result = serializeClass(declaration, ctx);
  } else if (ts.isInterfaceDeclaration(declaration)) {
    result = serializeInterface(declaration, ctx);
  } else if (ts.isTypeAliasDeclaration(declaration)) {
    result = serializeTypeAlias(declaration, ctx);
  } else if (ts.isEnumDeclaration(declaration)) {
    result = serializeEnum(declaration, ctx);
  } else if (ts.isVariableDeclaration(declaration)) {
    // Find the parent variable statement for JSDoc
    const varStatement = declaration.parent?.parent as ts.VariableStatement | undefined;
    if (varStatement && ts.isVariableStatement(varStatement)) {
      result = serializeVariable(declaration, varStatement, ctx);
    }
  } else if (ts.isNamespaceExport(declaration) || ts.isModuleDeclaration(declaration)) {
    // Handle namespace exports like `export * as Foo from './foo'`
    // Use exportSymbol for JSDoc (it's on the export statement)
    result = serializeNamespaceExport(exportSymbol, exportName, ctx);
  } else if (ts.isSourceFile(declaration)) {
    // Handle namespace exports where the target resolves to a source file
    result = serializeNamespaceExport(exportSymbol, exportName, ctx);
  }

  // Apply export name (handles re-exports with different names)
  if (result) {
    result = withExportName(result, exportName);
  }

  return result;
}

function serializeNamespaceExport(
  symbol: ts.Symbol,
  exportName: string,
  ctx: SerializerContext,
): SpecExport {
  // Try to get JSDoc from the export declaration statement
  const { description, tags, examples } = getJSDocFromExportSymbol(symbol);

  return {
    id: exportName,
    name: exportName,
    kind: 'namespace',
    description,
    tags,
    ...(examples.length > 0 ? { examples } : {}),
  };
}

function getJSDocFromExportSymbol(symbol: ts.Symbol): {
  description?: string;
  tags: Array<{ name: string; text: string }>;
  examples: string[];
} {
  const tags: Array<{ name: string; text: string }> = [];
  const examples: string[] = [];

  // First try: get from the symbol's declaration's parent (ExportDeclaration)
  const decl = symbol.declarations?.[0];
  if (decl) {
    // For namespace exports, the declaration is NamespaceExport, parent is ExportDeclaration
    const exportDecl = ts.isNamespaceExport(decl) ? decl.parent : decl;
    if (exportDecl && ts.isExportDeclaration(exportDecl)) {
      const jsDocs = ts.getJSDocCommentsAndTags(exportDecl);
      for (const doc of jsDocs) {
        if (ts.isJSDoc(doc) && doc.comment) {
          const commentText =
            typeof doc.comment === 'string'
              ? doc.comment
              : doc.comment.map((c) => ('text' in c ? c.text : '')).join('');
          if (commentText) {
            return {
              description: commentText,
              tags: extractJSDocTags(doc),
              examples: extractExamples(doc),
            };
          }
        }
      }
    }
  }

  // Fallback: try symbol's documentation
  const docComment = symbol.getDocumentationComment(undefined);
  const description = docComment.map((c) => c.text).join('\n') || undefined;

  const jsTags = symbol.getJsDocTags();
  for (const tag of jsTags) {
    const text = tag.text?.map((t) => t.text).join('') ?? '';
    if (tag.name === 'example') {
      examples.push(text);
    } else {
      tags.push({ name: tag.name, text });
    }
  }

  return { description, tags, examples };
}

function extractJSDocTags(doc: ts.JSDoc): Array<{ name: string; text: string }> {
  const tags: Array<{ name: string; text: string }> = [];
  for (const tag of doc.tags ?? []) {
    if (tag.tagName.text !== 'example') {
      const text =
        typeof tag.comment === 'string'
          ? tag.comment
          : tag.comment?.map((c) => ('text' in c ? c.text : '')).join('') ?? '';
      tags.push({ name: tag.tagName.text, text });
    }
  }
  return tags;
}

function extractExamples(doc: ts.JSDoc): string[] {
  const examples: string[] = [];
  for (const tag of doc.tags ?? []) {
    if (tag.tagName.text === 'example') {
      const text =
        typeof tag.comment === 'string'
          ? tag.comment
          : tag.comment?.map((c) => ('text' in c ? c.text : '')).join('') ?? '';
      if (text) examples.push(text);
    }
  }
  return examples;
}

/**
 * Rewrite entry to use the public export name when re-exported.
 */
function withExportName(entry: SpecExport, exportName: string): SpecExport {
  if (entry.name === exportName) {
    return entry;
  }
  // Keep original name in the entry but use exportName as id
  return {
    ...entry,
    id: exportName,
    name: entry.name, // Original declaration name
  };
}

function createEmptySpec(entryFile: string): OpenPkg {
  return {
    openpkg: SCHEMA_VERSION,
    meta: { name: path.basename(entryFile, path.extname(entryFile)) },
    exports: [],
    generation: {
      generator: '@openpkg-ts/extract',
      timestamp: new Date().toISOString(),
    },
  };
}

async function getPackageMeta(
  entryFile: string,
  baseDir?: string,
): Promise<{ name: string; version?: string; description?: string }> {
  const searchDir = baseDir ?? path.dirname(entryFile);
  const pkgPath = path.join(searchDir, 'package.json');

  try {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return {
        name: pkg.name ?? path.basename(searchDir),
        version: pkg.version,
        description: pkg.description,
      };
    }
  } catch {
    // Ignore errors
  }

  return { name: path.basename(searchDir) };
}
