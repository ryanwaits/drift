import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SpecMember, SpecSchema, SpecSource, SpecType, SpecTypeKind } from '@openpkg-ts/spec';
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

    // Build source with package info for external types
    const source = decl ? buildExternalSource(decl) : undefined;

    // Build structured schema (shallow, to avoid deep recursion)
    const schema = this.buildShallowSchema(type, checker);

    // Extract members for classes/interfaces
    let members: SpecMember[] | undefined;
    if (decl && (ts.isClassDeclaration(decl) || ts.isInterfaceDeclaration(decl))) {
      members = this.extractShallowMembers(decl, checker);
    }

    return {
      id: name,
      name,
      kind,
      schema,
      members: members?.length ? members : undefined,
      ...(external ? { external: true } : {}),
      ...(source ? { source } : {}),
    };
  }

  /**
   * Build a shallow schema for registry types (no deep recursion).
   * Only captures top-level structure with $refs.
   */
  private buildShallowSchema(type: ts.Type, checker: ts.TypeChecker): SpecSchema {
    // Union → anyOf
    if (type.isUnion()) {
      // Check if all members are enum literals
      const allEnumLiterals = type.types.every(
        (t) => t.flags & (ts.TypeFlags.EnumLiteral | ts.TypeFlags.NumberLiteral),
      );
      if (allEnumLiterals) {
        // Extract enum values
        const values = type.types
          .map((t) => {
            if (t.flags & ts.TypeFlags.NumberLiteral) {
              return (t as ts.NumberLiteralType).value;
            }
            return checker.typeToString(t);
          })
          .filter((v) => v !== undefined);
        if (values.every((v) => typeof v === 'number')) {
          return { type: 'number', enum: values as number[] };
        }
        return { type: 'string', enum: values as string[] };
      }

      return {
        anyOf: type.types.map((t) => {
          // Skip enum members in unions - use their literal values
          if (t.flags & ts.TypeFlags.EnumLiteral) {
            const value = (t as ts.NumberLiteralType).value;
            if (typeof value === 'number') {
              return { type: 'number', enum: [value] };
            }
            return { type: checker.typeToString(t) };
          }

          const sym = t.getSymbol() || t.aliasSymbol;
          // Skip enum member symbols - they shouldn't become $refs
          if (sym && sym.flags & ts.SymbolFlags.EnumMember) {
            return { type: checker.typeToString(t) };
          }
          if (sym && !sym.getName().startsWith('__')) {
            return { $ref: `#/types/${sym.getName()}` };
          }
          // Literal or primitive
          if (t.flags & ts.TypeFlags.StringLiteral) {
            return { type: 'string', enum: [(t as ts.StringLiteralType).value] };
          }
          if (t.flags & ts.TypeFlags.NumberLiteral) {
            return { type: 'number', enum: [(t as ts.NumberLiteralType).value] };
          }
          return { type: checker.typeToString(t) };
        }),
      };
    }

    // Intersection → allOf
    if (type.isIntersection()) {
      return {
        allOf: type.types.map((t) => {
          const sym = t.getSymbol() || t.aliasSymbol;
          if (sym && !sym.getName().startsWith('__')) {
            return { $ref: `#/types/${sym.getName()}` };
          }
          return { type: checker.typeToString(t) };
        }),
      };
    }

    // Object with properties
    const props = type.getProperties();
    if (props.length > 0) {
      const properties: Record<string, SpecSchema> = {};
      const required: string[] = [];

      // Limit to first 30 properties to avoid huge schemas
      for (const prop of props.slice(0, 30)) {
        const propName = prop.getName();
        if (propName.startsWith('_')) continue;

        const propType = checker.getTypeOfSymbol(prop);

        // Check if it's a function/method type
        const callSigs = propType.getCallSignatures();
        if (callSigs.length > 0) {
          // It's a method - use function type
          properties[propName] = { type: 'function' };
        } else {
          const propSym = propType.getSymbol() || propType.aliasSymbol;
          const symName = propSym?.getName();

          // Only use $ref for named types, not for method names or anonymous
          if (propSym && symName && !symName.startsWith('__') && symName !== propName) {
            properties[propName] = { $ref: `#/types/${symName}` };
          } else {
            properties[propName] = { type: checker.typeToString(propType) };
          }
        }

        if (!(prop.flags & ts.SymbolFlags.Optional)) {
          required.push(propName);
        }
      }

      return {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
      };
    }

    return { type: checker.typeToString(type) };
  }

  /**
   * Extract shallow members for classes/interfaces.
   * Only captures property names and simple type info.
   */
  private extractShallowMembers(
    decl: ts.ClassDeclaration | ts.InterfaceDeclaration,
    checker: ts.TypeChecker,
  ): SpecMember[] {
    const members: SpecMember[] = [];

    for (const member of decl.members) {
      // Handle PropertyDeclaration (class) and PropertySignature (interface)
      if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
        const name = member.name?.getText();
        if (!name || name.startsWith('#') || name.startsWith('_')) continue;

        const type = checker.getTypeAtLocation(member);
        const sym = type.getSymbol() || type.aliasSymbol;

        members.push({
          name,
          kind: 'property',
          schema:
            sym && !sym.getName().startsWith('__')
              ? { $ref: `#/types/${sym.getName()}` }
              : { type: checker.typeToString(type) },
        });
      } else if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
        const name = member.name?.getText();
        if (!name || name.startsWith('#') || name.startsWith('_')) continue;

        members.push({
          name,
          kind: 'method',
        });
      }
    }

    return members;
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
