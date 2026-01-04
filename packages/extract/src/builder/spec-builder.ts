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
import type {
  Diagnostic,
  ExtractOptions,
  ExtractResult,
  ForgottenExport,
  TypeReference,
} from '../types';

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

  // Check for forgotten exports (refs to types not defined)
  const forgottenExports = collectForgottenExports(exports, types, program, sourceFile);
  for (const forgotten of forgottenExports) {
    const refSummary = forgotten.referencedBy
      .slice(0, 3)
      .map((r) => `${r.exportName} (${r.location})`)
      .join(', ');
    const moreRefs =
      forgotten.referencedBy.length > 3 ? ` +${forgotten.referencedBy.length - 3} more` : '';

    if (forgotten.isExternal) {
      diagnostics.push({
        message: `External type '${forgotten.name}' referenced by: ${refSummary}${moreRefs}`,
        severity: 'info',
        code: 'EXTERNAL_TYPE_REF',
        suggestion: forgotten.definedIn
          ? `Type is from: ${forgotten.definedIn}`
          : 'Type is from an external package',
      });
    } else {
      diagnostics.push({
        message: `Forgotten export: '${forgotten.name}' referenced by: ${refSummary}${moreRefs}`,
        severity: 'warning',
        code: 'FORGOTTEN_EXPORT',
        suggestion: forgotten.fix ?? `Export this type from your public API`,
        location: forgotten.definedIn ? { file: forgotten.definedIn } : undefined,
      });
    }
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

  // Filter to only internal forgotten exports (for fix generation)
  const internalForgotten = forgottenExports.filter((f) => !f.isExternal);

  return {
    spec,
    diagnostics,
    ...(internalForgotten.length > 0 ? { forgottenExports: internalForgotten } : {}),
  };
}

/** Location context for type reference tracking */
type RefLocation = TypeReference['location'];

/** State for tracking reference context during traversal */
interface RefTraversalState {
  exportName: string;
  location: RefLocation;
  path: string[];
}

/**
 * Collect all $ref values with context (which export, location type, path)
 */
function collectAllRefsWithContext(
  obj: unknown,
  refs: Map<string, TypeReference[]>,
  state: RefTraversalState,
): void {
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      collectAllRefsWithContext(obj[i], refs, {
        ...state,
        path: [...state.path, `[${i}]`],
      });
    }
    return;
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    if (typeof record.$ref === 'string' && record.$ref.startsWith('#/types/')) {
      const typeName = record.$ref.slice('#/types/'.length);
      const existing = refs.get(typeName) ?? [];
      existing.push({
        typeName,
        exportName: state.exportName,
        location: state.location,
        path: state.path.join('.') || undefined,
      });
      refs.set(typeName, existing);
    }

    for (const [key, value] of Object.entries(record)) {
      // Infer location from property name
      let newLocation = state.location;
      if (key === 'returnType' || key === 'returns') newLocation = 'return';
      else if (key === 'parameters' || key === 'params') newLocation = 'parameter';
      else if (key === 'properties' || key === 'members') newLocation = 'property';
      else if (key === 'extends' || key === 'implements') newLocation = 'extends';
      else if (key === 'typeParameters' || key === 'typeParams') newLocation = 'type-parameter';

      collectAllRefsWithContext(value, refs, {
        ...state,
        location: newLocation,
        path: [...state.path, key],
      });
    }
  }
}

/**
 * Find where a type is defined in the source files
 */
function findTypeDefinition(
  typeName: string,
  program: ts.Program,
  sourceFile: ts.SourceFile,
): string | undefined {
  const checker = program.getTypeChecker();

  // Search in the entry source file first
  const findInNode = (node: ts.Node): string | undefined => {
    if (
      (ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.name?.text === typeName
    ) {
      const sf = node.getSourceFile();
      return sf.fileName;
    }

    return ts.forEachChild(node, findInNode);
  };

  // Check entry file
  const entryResult = findInNode(sourceFile);
  if (entryResult) return entryResult;

  // Check all source files in program
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile && !sf.fileName.includes('node_modules')) {
      const result = findInNode(sf);
      if (result) return result;
    }
  }

  // Try to find via type checker symbol lookup
  const symbol = checker.resolveName(typeName, sourceFile, ts.SymbolFlags.Type, false);
  if (symbol?.declarations?.[0]) {
    return symbol.declarations[0].getSourceFile().fileName;
  }

  return undefined;
}

/**
 * Determine if a type is external (from node_modules/dependencies)
 */
function isExternalType(definedIn: string | undefined): boolean {
  if (!definedIn) return true;
  return definedIn.includes('node_modules');
}

/**
 * Check if a type has @internal JSDoc tag
 */
function hasInternalTag(typeName: string, program: ts.Program, sourceFile: ts.SourceFile): boolean {
  const checker = program.getTypeChecker();

  // Try to find the symbol for this type
  const symbol = checker.resolveName(typeName, sourceFile, ts.SymbolFlags.Type, false);
  if (!symbol) return false;

  // Check JSDoc tags on the symbol
  const jsTags = symbol.getJsDocTags();
  return jsTags.some((tag) => tag.name === 'internal');
}

/**
 * Find all dangling $ref references with enhanced context
 */
function collectForgottenExports(
  exports: SpecExport[],
  types: SpecType[],
  program: ts.Program,
  sourceFile: ts.SourceFile,
): ForgottenExport[] {
  const definedTypes = new Set(types.map((t) => t.id));
  const referencedTypes = new Map<string, TypeReference[]>();

  // Collect refs from exports with context
  for (const exp of exports) {
    collectAllRefsWithContext(exp, referencedTypes, {
      exportName: exp.id || exp.name,
      location: 'property',
      path: [],
    });
  }

  // Collect refs from types themselves (for nested refs)
  for (const type of types) {
    collectAllRefsWithContext(type, referencedTypes, {
      exportName: type.id,
      location: 'property',
      path: [],
    });
  }

  const forgottenExports: ForgottenExport[] = [];

  for (const [typeName, references] of referencedTypes) {
    // Skip if already defined, builtin, or should be skipped
    if (definedTypes.has(typeName)) continue;
    if (BUILTIN_TYPES.has(typeName)) continue;
    if (shouldSkipDanglingRef(typeName)) continue;
    // Skip types marked @internal - intentionally not exported
    if (hasInternalTag(typeName, program, sourceFile)) continue;

    const definedIn = findTypeDefinition(typeName, program, sourceFile);
    const isExternal = isExternalType(definedIn);

    forgottenExports.push({
      name: typeName,
      definedIn,
      referencedBy: references,
      isExternal,
      fix: isExternal ? undefined : `export { ${typeName} } from '${definedIn ?? './types'}'`,
    });
  }

  return forgottenExports;
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
