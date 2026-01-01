import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SpecSource, SpecType, SpecTypeKind } from '@openpkg-ts/spec';
import ts from 'typescript';

const PRIMITIVES = new Set([
  'string',
  'number',
  'boolean',
  'void',
  'any',
  'undefined',
  'null',
  'never',
  'unknown',
  'object',
  'symbol',
  'bigint',
]);

/** Built-in types that shouldn't be registered */
const BUILTINS = new Set([
  'Array',
  'ArrayBuffer',
  'ArrayBufferLike',
  'ArrayLike',
  'Promise',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
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
  'ReadonlyArray',
  'Readonly',
  'Partial',
  'Required',
  'Pick',
  'Omit',
  'Record',
  'Exclude',
  'Extract',
  'NonNullable',
  'Parameters',
  'ReturnType',
  'ConstructorParameters',
  'InstanceType',
  'ThisType',
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
  'SharedArrayBuffer',
  'Atomics',
  'JSON',
  'Math',
  'console',
  'globalThis',
]);

/**
 * Heuristic to detect generic type parameter names.
 * Matches: T, K, V, TType, TValue, TResult, TWire, etc.
 */
function isGenericTypeParameter(name: string): boolean {
  // Single uppercase letter
  if (/^[A-Z]$/.test(name)) return true;
  // Starts with T followed by uppercase (TType, TValue, TWire, etc.)
  if (/^T[A-Z]/.test(name)) return true;
  // Common generic names
  if (['Key', 'Value', 'Item', 'Element'].includes(name)) return true;
  return false;
}

/**
 * Check if a declaration is from an external package (node_modules).
 */
function isExternalType(decl: ts.Declaration): boolean {
  const sourceFile = decl.getSourceFile();
  if (!sourceFile) return false;
  return sourceFile.fileName.includes('node_modules');
}

/**
 * Extract package name from a node_modules path.
 * Handles scoped packages like @scope/pkg.
 */
function extractPackageName(filePath: string): string | undefined {
  const nmIndex = filePath.lastIndexOf('node_modules');
  if (nmIndex === -1) return undefined;

  const afterNm = filePath.slice(nmIndex + 'node_modules/'.length);
  const parts = afterNm.split('/');

  if (parts[0].startsWith('@') && parts.length >= 2) {
    // Scoped package: @scope/pkg
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

/**
 * Get package version from package.json in node_modules.
 */
function getPackageVersion(filePath: string, packageName: string): string | undefined {
  const nmIndex = filePath.lastIndexOf('node_modules');
  if (nmIndex === -1) return undefined;

  const nmDir = filePath.slice(0, nmIndex + 'node_modules'.length);
  const pkgJsonPath = path.join(nmDir, packageName, 'package.json');

  try {
    if (fs.existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      return pkg.version;
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Build SpecSource with external package info if applicable.
 */
function buildExternalSource(decl: ts.Declaration): SpecSource | undefined {
  const sourceFile = decl.getSourceFile();
  if (!sourceFile) return undefined;

  const filePath = sourceFile.fileName;
  if (!filePath.includes('node_modules')) return undefined;

  const packageName = extractPackageName(filePath);
  if (!packageName) return undefined;

  const version = getPackageVersion(filePath, packageName);

  return {
    file: filePath,
    package: packageName,
    version,
  };
}

export class TypeRegistry {
  private types = new Map<string, SpecType>();
  private processing = new Set<string>();

  add(type: SpecType): void {
    this.types.set(type.id, type);
  }

  get(id: string): SpecType | undefined {
    return this.types.get(id);
  }

  has(id: string): boolean {
    return this.types.has(id);
  }

  getAll(): SpecType[] {
    return Array.from(this.types.values());
  }

  /**
   * Register a type from a ts.Type, extracting its structure.
   * Returns the type ID if registered, undefined if skipped.
   */
  registerType(
    type: ts.Type,
    checker: ts.TypeChecker,
    exportedIds: Set<string>,
  ): string | undefined {
    const symbol = type.getSymbol() || type.aliasSymbol;
    if (!symbol) return undefined;

    const name = symbol.getName();

    // Skip primitives, builtins, already registered, already exported, or anonymous
    if (PRIMITIVES.has(name)) return undefined;
    if (BUILTINS.has(name)) return undefined;
    if (name.startsWith('__')) return undefined; // __type, __object, __function, etc.
    // Skip enum members (they're part of their parent enum, not standalone types)
    if (symbol.flags & ts.SymbolFlags.EnumMember) return undefined;
    // Skip generic type parameters (T, K, V, TType, TValue, etc.)
    if (symbol.flags & ts.SymbolFlags.TypeParameter) return undefined;
    if (isGenericTypeParameter(name)) return undefined;
    if (this.has(name)) return name;
    if (exportedIds.has(name)) return name;

    // Prevent infinite recursion
    if (this.processing.has(name)) return name;
    this.processing.add(name);

    try {
      const specType = this.buildSpecType(symbol, type, checker);
      if (specType) {
        this.add(specType);
        return specType.id;
      }
    } finally {
      this.processing.delete(name);
    }

    return undefined;
  }

  private buildSpecType(
    symbol: ts.Symbol,
    type: ts.Type,
    checker: ts.TypeChecker,
  ): SpecType | undefined {
    const name = symbol.getName();
    const decl = symbol.declarations?.[0];

    let kind: SpecTypeKind = 'type';
    const external = decl ? isExternalType(decl) : false;

    if (decl) {
      if (ts.isClassDeclaration(decl)) kind = 'class';
      else if (ts.isInterfaceDeclaration(decl)) kind = 'interface';
      else if (ts.isEnumDeclaration(decl)) kind = 'enum';
    }

    // Mark external types with 'external' kind if they're from node_modules
    if (external) {
      kind = 'external';
    }

    const typeString = checker.typeToString(type);

    // Build source with package info for external types
    const source = decl ? buildExternalSource(decl) : undefined;

    return {
      id: name,
      name,
      kind,
      type: typeString !== name ? typeString : undefined,
      ...(external ? { external: true } : {}),
      ...(source ? { source } : {}),
    };
  }

  registerFromSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): SpecType | undefined {
    const name = symbol.getName();
    if (this.has(name)) return this.get(name);

    const type = checker.getDeclaredTypeOfSymbol(symbol);
    const specType = this.buildSpecType(symbol, type, checker);
    if (specType) {
      this.add(specType);
      return specType;
    }
    return undefined;
  }
}
