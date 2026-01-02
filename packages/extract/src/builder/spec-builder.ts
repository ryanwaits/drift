import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OpenPkg, SpecExport, SpecMember, SpecType } from '@openpkg-ts/spec';
import { SCHEMA_URL, SCHEMA_VERSION } from '@openpkg-ts/spec';
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

/** Built-in types that shouldn't be tracked as dangling refs */
const BUILTIN_TYPES = new Set([
  'Array',
  'ArrayBuffer',
  'ArrayBufferLike',
  'ArrayLike',
  'Promise',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Record',
  'Partial',
  'Required',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'NonNullable',
  'Parameters',
  'ReturnType',
  'Readonly',
  'ReadonlyArray',
  'Awaited',
  'PromiseLike',
  'Iterable',
  'Iterator',
  'IterableIterator',
  'Generator',
  'AsyncGenerator',
  'AsyncIterable',
  'AsyncIterator',
  'AsyncIterableIterator',
  'Date',
  'RegExp',
  'Error',
  'Function',
  'Object',
  'String',
  'Number',
  'Boolean',
  'Symbol',
  'BigInt',
  'Uint8Array',
  'Int8Array',
  'Uint16Array',
  'Int16Array',
  'Uint32Array',
  'Int32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'DataView',
  'SharedArrayBuffer',
  'ConstructorParameters',
  'InstanceType',
  'ThisType',
]);

/**
 * Check if a type name should be skipped (anonymous, generic param, etc.)
 */
function shouldSkipDanglingRef(name: string): boolean {
  // Anonymous types
  if (name.startsWith('__')) return true;
  // Single uppercase letter (generic params)
  if (/^[A-Z]$/.test(name)) return true;
  // Starts with T followed by uppercase (TType, TValue, TWire, etc.)
  if (/^T[A-Z]/.test(name)) return true;
  // Common generic names
  if (['Key', 'Value', 'Item', 'Element'].includes(name)) return true;
  return false;
}

export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  const {
    entryFile,
    baseDir,
    content,
    maxTypeDepth,
    maxExternalTypeDepth,
    resolveExternalTypes,
    includeSchema,
  } = options;

  const diagnostics: Diagnostic[] = [];
  const exports: SpecExport[] = [];

  // Create program
  const result = createProgram({ entryFile, baseDir, content });
  const { program, sourceFile } = result;

  if (!sourceFile) {
    return {
      spec: createEmptySpec(entryFile, includeSchema),
      diagnostics: [{ message: `Could not load source file: ${entryFile}`, severity: 'error' }],
    };
  }

  const typeChecker = program.getTypeChecker();

  // Get module symbol and its exports (handles re-exports properly)
  const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return {
      spec: createEmptySpec(entryFile, includeSchema),
      diagnostics: [{ message: 'Could not get module symbol', severity: 'warning' }],
    };
  }

  const exportedSymbols = typeChecker.getExportsOfModule(moduleSymbol);

  // First pass: collect all export names so we can skip them when registering types
  const exportedIds = new Set<string>();
  for (const symbol of exportedSymbols) {
    exportedIds.add(symbol.getName());
  }

  const ctx = createContext(program, sourceFile, {
    maxTypeDepth,
    maxExternalTypeDepth,
    resolveExternalTypes,
  });
  ctx.exportedIds = exportedIds;

  for (const symbol of exportedSymbols) {
    const exportName = symbol.getName();

    try {
      const { declaration, targetSymbol } = resolveExportTarget(symbol, typeChecker);
      if (!declaration) continue;

      const exp = serializeDeclaration(declaration, symbol, targetSymbol, exportName, ctx);
      if (exp) exports.push(exp);
    } catch (err) {
      diagnostics.push({
        message: `Failed to serialize ${exportName}: ${err}`,
        severity: 'warning',
      });
    }
  }

  // Get package metadata
  const meta = await getPackageMeta(entryFile, baseDir);
  const types = ctx.typeRegistry.getAll();

  // Check for dangling $refs (refs to types not defined)
  const danglingRefs = collectDanglingRefs(exports, types);
  for (const ref of danglingRefs) {
    diagnostics.push({
      message: `Type '${ref}' is referenced but not defined in types[].`,
      severity: 'warning',
      code: 'DANGLING_REF',
      suggestion: 'The type may be from an external package. Check import paths.',
    });
  }

  // Check for external type stubs (info only - external stubs are expected)
  const externalTypes = types.filter((t) => t.kind === 'external');
  if (externalTypes.length > 0) {
    diagnostics.push({
      message: `${externalTypes.length} external type(s) from dependencies: ${externalTypes
        .slice(0, 5)
        .map((t) => t.id)
        .join(', ')}${externalTypes.length > 5 ? '...' : ''}`,
      severity: 'info',
      code: 'EXTERNAL_TYPES',
    });
  }

  const spec: OpenPkg = {
    ...(includeSchema ? { $schema: SCHEMA_URL } : {}),
    openpkg: SCHEMA_VERSION,
    meta,
    exports,
    types,
    generation: {
      generator: '@openpkg-ts/extract',
      timestamp: new Date().toISOString(),
    },
  };

  return { spec, diagnostics };
}

/**
 * Collect all $ref values from a nested object/array structure
 */
function collectAllRefs(obj: unknown, refs: Set<string>): void {
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectAllRefs(item, refs);
    }
    return;
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    if (typeof record.$ref === 'string' && record.$ref.startsWith('#/types/')) {
      refs.add(record.$ref.slice('#/types/'.length));
    }
    for (const value of Object.values(record)) {
      collectAllRefs(value, refs);
    }
  }
}

/**
 * Find all dangling $ref references (refs to types not in types[])
 */
function collectDanglingRefs(exports: SpecExport[], types: SpecType[]): string[] {
  const definedTypes = new Set(types.map((t) => t.id));
  const referencedTypes = new Set<string>();

  collectAllRefs(exports, referencedTypes);
  collectAllRefs(types, referencedTypes);

  return Array.from(referencedTypes).filter(
    (ref) => !definedTypes.has(ref) && !BUILTIN_TYPES.has(ref) && !shouldSkipDanglingRef(ref),
  );
}

/**
 * Follows export aliases back to the declaration that carries the type info.
 */
function resolveExportTarget(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): { declaration?: ts.Declaration; targetSymbol: ts.Symbol } {
  let targetSymbol = symbol;

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
  _targetSymbol: ts.Symbol,
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
    const varStatement = declaration.parent?.parent as ts.VariableStatement | undefined;
    if (varStatement && ts.isVariableStatement(varStatement)) {
      result = serializeVariable(declaration, varStatement, ctx);
    }
  } else if (ts.isNamespaceExport(declaration) || ts.isModuleDeclaration(declaration)) {
    result = serializeNamespaceExport(exportSymbol, exportName, ctx);
  } else if (ts.isSourceFile(declaration)) {
    result = serializeNamespaceExport(exportSymbol, exportName, ctx);
  }

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
  const { description, tags, examples } = getJSDocFromExportSymbol(symbol);

  // Extract namespace members
  const members: SpecMember[] = [];
  const checker = ctx.program.getTypeChecker();

  // Resolve alias to get the actual module symbol
  let targetSymbol = symbol;
  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(symbol);
    if (aliased && aliased !== symbol) {
      targetSymbol = aliased;
    }
  }

  // Get exports from the namespace module
  const nsExports = checker.getExportsOfModule(targetSymbol);

  for (const memberSymbol of nsExports) {
    const memberName = memberSymbol.getName();
    const member = serializeNamespaceMember(memberSymbol, memberName, ctx);
    if (member) {
      members.push(member);
    }
  }

  return {
    id: exportName,
    name: exportName,
    kind: 'namespace',
    description,
    tags,
    ...(examples.length > 0 ? { examples } : {}),
    ...(members.length > 0 ? { members } : {}),
  };
}

function serializeNamespaceMember(
  symbol: ts.Symbol,
  memberName: string,
  ctx: SerializerContext,
): SpecMember | null {
  const checker = ctx.program.getTypeChecker();

  // Resolve alias if needed
  let targetSymbol = symbol;
  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(symbol);
    if (aliased && aliased !== symbol) {
      targetSymbol = aliased;
    }
  }

  const declarations = targetSymbol.declarations ?? [];
  const declaration =
    targetSymbol.valueDeclaration ||
    declarations.find((d) => d.kind !== ts.SyntaxKind.ExportSpecifier) ||
    declarations[0];

  if (!declaration) return null;

  // Determine kind
  let kind: string = 'variable';
  if (ts.isFunctionDeclaration(declaration) || ts.isFunctionExpression(declaration)) {
    kind = 'function';
  } else if (ts.isClassDeclaration(declaration)) {
    kind = 'class';
  } else if (ts.isInterfaceDeclaration(declaration)) {
    kind = 'interface';
  } else if (ts.isTypeAliasDeclaration(declaration)) {
    kind = 'type';
  } else if (ts.isEnumDeclaration(declaration)) {
    kind = 'enum';
  } else if (ts.isVariableDeclaration(declaration)) {
    // Check if it's a function assigned to a variable
    const type = checker.getTypeAtLocation(declaration);
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0) {
      kind = 'function';
    }
  }

  // Get description from JSDoc
  const docComment = targetSymbol.getDocumentationComment(checker);
  const description = docComment.map((c) => c.text).join('\n') || undefined;

  return {
    name: memberName,
    kind,
    ...(description ? { description } : {}),
  };
}

function getJSDocFromExportSymbol(symbol: ts.Symbol): {
  description?: string;
  tags: Array<{ name: string; text: string }>;
  examples: string[];
} {
  const tags: Array<{ name: string; text: string }> = [];
  const examples: string[] = [];

  const decl = symbol.declarations?.[0];
  if (decl) {
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
          : (tag.comment?.map((c) => ('text' in c ? c.text : '')).join('') ?? '');
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
          : (tag.comment?.map((c) => ('text' in c ? c.text : '')).join('') ?? '');
      if (text) examples.push(text);
    }
  }
  return examples;
}

function withExportName(entry: SpecExport, exportName: string): SpecExport {
  if (entry.name === exportName) {
    return entry;
  }
  return {
    ...entry,
    id: exportName,
    name: entry.name,
  };
}

function createEmptySpec(entryFile: string, includeSchema?: boolean): OpenPkg {
  return {
    ...(includeSchema ? { $schema: SCHEMA_URL } : {}),
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
