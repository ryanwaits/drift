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
    if (decl) {
      if (ts.isClassDeclaration(decl)) kind = 'class';
      else if (ts.isInterfaceDeclaration(decl)) kind = 'interface';
      else if (ts.isEnumDeclaration(decl)) kind = 'enum';
    }

    const typeString = checker.typeToString(type);

    return {
      id: name,
      name,
      kind,
      type: typeString !== name ? typeString : undefined,
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
