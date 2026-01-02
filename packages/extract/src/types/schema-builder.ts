import type { SpecSchema, SpecSignature } from '@openpkg-ts/spec';
import ts from 'typescript';
import type { SerializerContext } from '../serializers/context';

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
  if (ctx && ctx.visitedTypes.has(type)) {
    const symbol = type.getSymbol() || type.aliasSymbol;
    if (symbol) {
      return { $ref: symbol.getName() };
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
      return { $ref: name };
    }

    if (name && (isBuiltinGeneric(name) || !isAnonymous(typeRef.target))) {
      if (ctx) {
        return withDepth(ctx, () => ({
          $ref: name,
          typeArguments: typeRef.typeArguments!.map((t) => buildSchema(t, checker, ctx)),
        }));
      }
      return {
        $ref: name,
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
      return { $ref: name };
    }

    // Named type → $ref
    if (!name.startsWith('__')) {
      return { $ref: name };
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
