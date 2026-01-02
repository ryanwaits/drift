import type { SpecType, SpecTypeKind } from '@openpkg-ts/spec';
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
   * Register a type from a ts.Type (lightweight stub).
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

    // Skip primitives, builtins, already registered, or anonymous
    if (PRIMITIVES.has(name)) return undefined;
    if (BUILTINS.has(name)) return undefined;
    if (name.startsWith('__')) return undefined;
    if (symbol.flags & ts.SymbolFlags.EnumMember) return undefined;
    if (symbol.flags & ts.SymbolFlags.TypeParameter) return undefined;
    // Skip methods/functions - they're not types
    if (symbol.flags & ts.SymbolFlags.Method) return undefined;
    if (symbol.flags & ts.SymbolFlags.Function) return undefined;
    if (isGenericTypeParameter(name)) return undefined;
    if (this.has(name)) return name;

    // Prevent infinite recursion
    if (this.processing.has(name)) return name;
    this.processing.add(name);

    try {
      const specType = this.buildStubType(symbol, checker);
      if (specType) {
        this.add(specType);
        return specType.id;
      }
    } finally {
      this.processing.delete(name);
    }

    return undefined;
  }

  /**
   * Build a lightweight stub type (no deep schema extraction).
   */
  private buildStubType(symbol: ts.Symbol, checker: ts.TypeChecker): SpecType | undefined {
    const name = symbol.getName();
    const decl = symbol.declarations?.[0];

    let kind: SpecTypeKind = 'type';
    const external = decl ? isExternalType(decl) : false;

    if (decl) {
      if (ts.isClassDeclaration(decl)) kind = 'class';
      else if (ts.isInterfaceDeclaration(decl)) kind = 'interface';
      else if (ts.isEnumDeclaration(decl)) kind = 'enum';
    }

    if (external) {
      kind = 'external';
    }

    // Get the type string representation (lightweight)
    const type = checker.getDeclaredTypeOfSymbol(symbol);
    const typeString = checker.typeToString(type);

    return {
      id: name,
      name,
      kind,
      schema: { type: typeString },
      ...(external ? { external: true } : {}),
    };
  }

  registerFromSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): SpecType | undefined {
    const name = symbol.getName();
    if (this.has(name)) return this.get(name);

    const specType = this.buildStubType(symbol, checker);
    if (specType) {
      this.add(specType);
      return specType;
    }
    return undefined;
  }
}
