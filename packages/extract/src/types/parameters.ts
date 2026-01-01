import type { SpecSignatureParameter } from '@openpkg-ts/spec';
import type ts from 'typescript';
import type { SerializerContext } from '../serializers/context';

export function extractParameters(
  signature: ts.Signature,
  ctx: SerializerContext,
): SpecSignatureParameter[] {
  const { typeChecker: checker, typeRegistry, exportedIds } = ctx;

  return signature.getParameters().map((param) => {
    const type = checker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!);

    // Register referenced types
    registerReferencedTypes(type, ctx);

    return {
      name: param.getName(),
      schema: { type: checker.typeToString(type) },
      required: !((param.flags & 16777216) /* Optional */),
    };
  });
}

/**
 * Recursively register types referenced by a ts.Type.
 * Uses ctx.visitedTypes to prevent infinite recursion on circular types.
 */
export function registerReferencedTypes(type: ts.Type, ctx: SerializerContext): void {
  // Prevent infinite recursion on circular types
  if (ctx.visitedTypes.has(type)) return;
  ctx.visitedTypes.add(type);

  const { typeChecker: checker, typeRegistry, exportedIds } = ctx;

  // Register the type itself
  typeRegistry.registerType(type, checker, exportedIds);

  // Handle type arguments (generics like Array<T>, Promise<T>)
  const typeArgs = (type as ts.TypeReference).typeArguments;
  if (typeArgs) {
    for (const arg of typeArgs) {
      registerReferencedTypes(arg, ctx);
    }
  }

  // Handle union types
  if (type.isUnion()) {
    for (const t of type.types) {
      registerReferencedTypes(t, ctx);
    }
  }

  // Handle intersection types
  if (type.isIntersection()) {
    for (const t of type.types) {
      registerReferencedTypes(t, ctx);
    }
  }
}
