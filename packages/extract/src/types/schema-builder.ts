import type { SpecSchema, SpecSignature } from '@openpkg-ts/spec';
import ts from 'typescript';
import type { SerializerContext } from '../serializers/context';

/**
 * Built-in type schemas with JSON Schema format hints.
 * Used for types that have specific serialization formats.
 */
export const BUILTIN_TYPE_SCHEMAS: Record<string, SpecSchema> = {
  Date: { type: 'string', format: 'date-time' },
  RegExp: { type: 'object', description: 'RegExp' },
  Error: { type: 'object' },
  Promise: { type: 'object' },
  Map: { type: 'object' },
  Set: { type: 'object' },
  WeakMap: { type: 'object' },
  WeakSet: { type: 'object' },
  Function: { type: 'object' },
  ArrayBuffer: { type: 'string', format: 'binary' },
  ArrayBufferLike: { type: 'string', format: 'binary' },
  DataView: { type: 'string', format: 'binary' },
  Uint8Array: { type: 'string', format: 'byte' },
  Uint16Array: { type: 'string', format: 'byte' },
  Uint32Array: { type: 'string', format: 'byte' },
  Int8Array: { type: 'string', format: 'byte' },
  Int16Array: { type: 'string', format: 'byte' },
  Int32Array: { type: 'string', format: 'byte' },
  Float32Array: { type: 'string', format: 'byte' },
  Float64Array: { type: 'string', format: 'byte' },
  BigInt64Array: { type: 'string', format: 'byte' },
  BigUint64Array: { type: 'string', format: 'byte' },
};

// Primitive type names
const PRIMITIVES = new Set([
  'string',
  'number',
  'boolean',
  'void',
  'undefined',
  'null',
  'any',
  'unknown',
  'never',
  'object',
  'symbol',
  'bigint',
]);

// Built-in generic types that use $ref + typeArguments
const BUILTIN_GENERICS = new Set([
  'Array',
  'ReadonlyArray',
  'Promise',
  'PromiseLike',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Iterable',
  'Iterator',
  'IterableIterator',
  'AsyncIterable',
  'AsyncIterator',
  'AsyncIterableIterator',
  'Generator',
  'AsyncGenerator',
  'Partial',
  'Required',
  'Readonly',
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
  'Awaited',
]);

// Built-in non-generic types
const BUILTIN_TYPES = new Set([
  'Date',
  'RegExp',
  'Error',
  'Function',
  'ArrayBuffer',
  'SharedArrayBuffer',
  'DataView',
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
]);

/**
 * Check if a name is a primitive type
 */
export function isPrimitiveName(name: string): boolean {
  return PRIMITIVES.has(name);
}

/**
 * Check if a name is a built-in generic type
 */
export function isBuiltinGeneric(name: string): boolean {
  return BUILTIN_GENERICS.has(name);
}

/**
 * Check if a type is anonymous (no meaningful symbol name)
 */
export function isAnonymous(type: ts.Type): boolean {
  const symbol = type.getSymbol() || type.aliasSymbol;
  if (!symbol) return true;
  const name = symbol.getName();
  return name.startsWith('__') || name === '';
}

/**
 * Execute a function with incremented depth, automatically decrementing after.
 */
function withDepth<T>(ctx: SerializerContext, fn: () => T): T {
  ctx.currentDepth++;
  try {
    return fn();
  } finally {
    ctx.currentDepth--;
  }
}

/**
 * Check if we've exceeded the depth limit for the current context.
 */
function isAtMaxDepth(ctx: SerializerContext | undefined): boolean {
  if (!ctx) return false;
  return ctx.currentDepth >= ctx.maxTypeDepth;
}

/**
 * Build a structured SpecSchema from a TypeScript type.
 * Uses $ref for named types and typeArguments for generics.
 */
export function buildSchema(
  type: ts.Type,
  checker: ts.TypeChecker,
  ctx?: SerializerContext,
  _depth = 0, // deprecated, use ctx.currentDepth instead
): SpecSchema {
  // Check depth limit using context
  if (isAtMaxDepth(ctx)) {
    return { type: checker.typeToString(type) };
  }

  // Check for circular references
  if (ctx?.visitedTypes.has(type)) {
    const symbol = type.getSymbol() || type.aliasSymbol;
    if (symbol) {
      return { $ref: `#/types/${symbol.getName()}` };
    }
    return { type: checker.typeToString(type) };
  }

  // Handle primitives via type flags
  if (type.flags & ts.TypeFlags.String) return { type: 'string' };
  if (type.flags & ts.TypeFlags.Number) return { type: 'number' };
  if (type.flags & ts.TypeFlags.Boolean) return { type: 'boolean' };
  if (type.flags & ts.TypeFlags.Undefined) return { type: 'undefined' };
  if (type.flags & ts.TypeFlags.Null) return { type: 'null' };
  if (type.flags & ts.TypeFlags.Void) return { type: 'void' };
  if (type.flags & ts.TypeFlags.Any) return { type: 'any' };
  if (type.flags & ts.TypeFlags.Unknown) return { type: 'unknown' };
  if (type.flags & ts.TypeFlags.Never) return { type: 'never' };
  if (type.flags & ts.TypeFlags.BigInt) return { type: 'bigint' };
  if (type.flags & ts.TypeFlags.ESSymbol) return { type: 'symbol' };

  // String literal
  if (type.flags & ts.TypeFlags.StringLiteral) {
    const literal = (type as ts.StringLiteralType).value;
    return { type: 'string', enum: [literal] };
  }

  // Number literal
  if (type.flags & ts.TypeFlags.NumberLiteral) {
    const literal = (type as ts.NumberLiteralType).value;
    return { type: 'number', enum: [literal] };
  }

  // Boolean literal (true/false)
  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    const intrinsicName = (type as ts.IntrinsicType).intrinsicName;
    return { type: 'boolean', enum: [intrinsicName === 'true'] };
  }

  // Union types → anyOf
  if (type.isUnion()) {
    // Check if this is a simple string/number literal union → enum
    const types = type.types;
    const allStringLiterals = types.every((t) => t.flags & ts.TypeFlags.StringLiteral);
    if (allStringLiterals) {
      const enumValues = types.map((t) => (t as ts.StringLiteralType).value);
      return { type: 'string', enum: enumValues };
    }

    const allNumberLiterals = types.every((t) => t.flags & ts.TypeFlags.NumberLiteral);
    if (allNumberLiterals) {
      const enumValues = types.map((t) => (t as ts.NumberLiteralType).value);
      return { type: 'number', enum: enumValues };
    }

    // General union → anyOf
    if (ctx) {
      return withDepth(ctx, () => ({
        anyOf: types.map((t) => buildSchema(t, checker, ctx)),
      }));
    }
    return { anyOf: types.map((t) => buildSchema(t, checker, ctx)) };
  }

  // Intersection types → allOf
  if (type.isIntersection()) {
    if (ctx) {
      return withDepth(ctx, () => ({
        allOf: type.types.map((t) => buildSchema(t, checker, ctx)),
      }));
    }
    return { allOf: type.types.map((t) => buildSchema(t, checker, ctx)) };
  }

  // Array type (T[])
  if (checker.isArrayType(type)) {
    const typeRef = type as ts.TypeReference;
    const elementType = typeRef.typeArguments?.[0];
    if (elementType) {
      if (ctx) {
        return withDepth(ctx, () => ({
          type: 'array',
          items: buildSchema(elementType, checker, ctx),
        }));
      }
      return { type: 'array', items: buildSchema(elementType, checker, ctx) };
    }
    return { type: 'array' };
  }

  // Tuple type - uses prefixedItems per JSON Schema 2020-12
  if (checker.isTupleType(type)) {
    const typeRef = type as ts.TypeReference;
    const elementTypes = typeRef.typeArguments ?? [];
    if (ctx) {
      return withDepth(ctx, () => ({
        type: 'array',
        prefixedItems: elementTypes.map((t) => buildSchema(t, checker, ctx)),
        minItems: elementTypes.length,
        maxItems: elementTypes.length,
      }));
    }
    return {
      type: 'array',
      prefixedItems: elementTypes.map((t) => buildSchema(t, checker, ctx)),
      minItems: elementTypes.length,
      maxItems: elementTypes.length,
    };
  }

  // Generic type reference (Promise<T>, Result<T,E>, etc.)
  const typeRef = type as ts.TypeReference;
  if (typeRef.target && typeRef.typeArguments && typeRef.typeArguments.length > 0) {
    const symbol = typeRef.target.getSymbol();
    const name = symbol?.getName();

    // Skip typeArguments for built-in non-generic types (like Uint8Array has internal T)
    if (name && BUILTIN_TYPES.has(name)) {
      return { $ref: `#/types/${name}` };
    }

    if (name && (isBuiltinGeneric(name) || !isAnonymous(typeRef.target))) {
      if (ctx) {
        return withDepth(ctx, () => ({
          $ref: `#/types/${name}`,
          typeArguments: typeRef.typeArguments!.map((t) => buildSchema(t, checker, ctx)),
        }));
      }
      return {
        $ref: `#/types/${name}`,
        typeArguments: typeRef.typeArguments.map((t) => buildSchema(t, checker, ctx)),
      };
    }
  }

  // Named types (classes, interfaces, type aliases)
  const symbol = type.getSymbol() || type.aliasSymbol;
  if (symbol && !isAnonymous(type)) {
    const name = symbol.getName();

    // Skip primitives
    if (isPrimitiveName(name)) {
      return { type: name };
    }

    // Built-in types without generics
    if (BUILTIN_TYPES.has(name)) {
      return { $ref: `#/types/${name}` };
    }

    // Named type → $ref
    if (!name.startsWith('__')) {
      return { $ref: `#/types/${name}` };
    }
  }

  // Object type (inline object literal)
  if (type.flags & ts.TypeFlags.Object) {
    const objectType = type as ts.ObjectType;

    // Function type
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0) {
      return buildFunctionSchema(callSignatures, checker, ctx);
    }

    // Object with properties
    const properties = type.getProperties();
    if (properties.length > 0 || objectType.objectFlags & ts.ObjectFlags.Anonymous) {
      return buildObjectSchema(properties, checker, ctx);
    }
  }

  // Fallback to type string
  return { type: checker.typeToString(type) };
}

/**
 * Build schema for function types
 */
function buildFunctionSchema(
  callSignatures: readonly ts.Signature[],
  checker: ts.TypeChecker,
  ctx: SerializerContext | undefined,
): SpecSchema {
  const buildSignatures = () => {
    const signatures: SpecSignature[] = callSignatures.map((sig) => {
      const params = sig.getParameters().map((param) => {
        const paramType = checker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!);
        return {
          name: param.getName(),
          schema: buildSchema(paramType, checker, ctx),
          required: !(param.flags & ts.SymbolFlags.Optional),
        };
      });

      const returnType = checker.getReturnTypeOfSignature(sig);

      return {
        parameters: params,
        returns: {
          schema: buildSchema(returnType, checker, ctx),
        },
      };
    });
    return signatures;
  };

  if (ctx) {
    return withDepth(ctx, () => ({ type: 'function', signatures: buildSignatures() }));
  }
  return { type: 'function', signatures: buildSignatures() };
}

/**
 * Build schema for object types with properties
 */
function buildObjectSchema(
  properties: ts.Symbol[],
  checker: ts.TypeChecker,
  ctx: SerializerContext | undefined,
): SpecSchema {
  const buildProps = () => {
    const props: Record<string, SpecSchema> = {};
    const required: string[] = [];

    for (const prop of properties) {
      const propName = prop.getName();
      // Skip private/internal properties
      if (propName.startsWith('_')) continue;

      const propType = checker.getTypeOfSymbol(prop);
      props[propName] = buildSchema(propType, checker, ctx);

      if (!(prop.flags & ts.SymbolFlags.Optional)) {
        required.push(propName);
      }
    }

    return {
      type: 'object' as const,
      properties: props,
      ...(required.length > 0 ? { required } : {}),
    };
  };

  if (ctx) {
    return withDepth(ctx, buildProps);
  }
  return buildProps();
}

// ============================================================================
// Schema Utilities (ported from SDK)
// ============================================================================

/**
 * Check if a schema is a pure $ref (only has $ref property)
 */
export function isPureRefSchema(schema: SpecSchema): schema is { $ref: string } {
  return typeof schema === 'object' && Object.keys(schema).length === 1 && '$ref' in schema;
}

/**
 * Add description to a schema, handling $ref properly.
 * For pure $ref schemas, wraps in allOf to preserve the reference.
 */
export function withDescription(schema: SpecSchema, description: string): SpecSchema {
  if (isPureRefSchema(schema)) {
    return {
      allOf: [schema],
      description,
    };
  }
  return { ...schema, description };
}

/**
 * Check if a schema represents the 'any' type
 */
export function schemaIsAny(schema: SpecSchema): boolean {
  if (typeof schema === 'string') {
    return schema === 'any';
  }
  if ('type' in schema && schema.type === 'any' && Object.keys(schema).length === 1) {
    return true;
  }
  return false;
}

/**
 * Deep equality comparison for schemas
 */
export function schemasAreEqual(left: SpecSchema, right: SpecSchema): boolean {
  if (typeof left !== typeof right) {
    return false;
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return left === right;
  }
  if (left == null || right == null) {
    return left === right;
  }

  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => normalize(item));
    }
    if (value && typeof value === 'object') {
      const sortedEntries = Object.entries(value)
        .map(([key, val]) => [key, normalize(val)] as const)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
      return Object.fromEntries(sortedEntries);
    }
    return value;
  };

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

/**
 * Remove duplicate schemas from an array while preserving order.
 */
export function deduplicateSchemas(schemas: SpecSchema[]): SpecSchema[] {
  const result: SpecSchema[] = [];
  for (const schema of schemas) {
    const isDuplicate = result.some((existing) => schemasAreEqual(existing, schema));
    if (!isDuplicate) {
      result.push(schema);
    }
  }
  return result;
}

/**
 * Find a discriminator property in a union of object types (tagged union pattern).
 * A valid discriminator has a unique literal value in each union member.
 */
export function findDiscriminatorProperty(
  unionTypes: ts.Type[],
  checker: ts.TypeChecker,
): string | undefined {
  const memberProps: Map<string, string | number>[] = [];

  for (const t of unionTypes) {
    // Skip null/undefined in unions
    if (t.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) {
      continue;
    }

    const props = t.getProperties();
    if (!props || props.length === 0) {
      return undefined; // Not an object type
    }

    const propValues = new Map<string, string | number>();
    for (const prop of props) {
      const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
      if (!declaration) continue;

      try {
        const propType = checker.getTypeOfSymbolAtLocation(prop, declaration);
        if (propType.isStringLiteral()) {
          propValues.set(prop.getName(), propType.value);
        } else if (propType.isNumberLiteral()) {
          propValues.set(prop.getName(), propType.value);
        }
      } catch {
        // Ignore errors
      }
    }
    memberProps.push(propValues);
  }

  if (memberProps.length < 2) {
    return undefined; // Need at least 2 object members
  }

  // Find property that exists in all members with unique literal values
  const firstMember = memberProps[0];
  for (const [propName, firstValue] of firstMember) {
    const values = new Set<string | number>([firstValue]);
    let isDiscriminator = true;

    for (let i = 1; i < memberProps.length; i++) {
      const value = memberProps[i].get(propName);
      if (value === undefined) {
        isDiscriminator = false;
        break;
      }
      if (values.has(value)) {
        // Duplicate value - not a valid discriminator
        isDiscriminator = false;
        break;
      }
      values.add(value);
    }

    if (isDiscriminator) {
      return propName;
    }
  }

  return undefined;
}
