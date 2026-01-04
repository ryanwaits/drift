import type * as TS from 'typescript';
import { ts } from '../ts-module';
import { isBuiltInTypeName } from './builtin-detection';

// Re-export for backward compatibility
export { isBuiltInTypeName as isBuiltInType } from './builtin-detection';

/**
 * Check if a parameter is using object destructuring
 */
export function isDestructuredParameter(param: TS.ParameterDeclaration): boolean {
  return param.name && ts.isObjectBindingPattern(param.name);
}

/**
 * Get the properties from a destructured parameter
 */
export function getDestructuredProperties(
  param: TS.ParameterDeclaration,
  typeChecker: TS.TypeChecker,
): Array<{ name: string; type: string; optional: boolean }> {
  if (!param.name || !ts.isObjectBindingPattern(param.name)) {
    return [];
  }

  const properties: Array<{ name: string; type: string; optional: boolean }> = [];
  const paramType = typeChecker.getTypeAtLocation(param);

  for (const element of param.name.elements) {
    if (ts.isBindingElement(element) && element.name && ts.isIdentifier(element.name)) {
      const propName = element.name.text;
      const propSymbol = paramType.getProperty(propName);

      if (propSymbol) {
        const propType = typeChecker.getTypeOfSymbolAtLocation(propSymbol, param);
        properties.push({
          name: propName,
          type: typeChecker.typeToString(propType),
          optional: !!element.initializer,
        });
      }
    }
  }

  return properties;
}

/**
 * Get a stable identifier for a type to avoid infinite recursion.
 * Uses TypeScript's internal type ID when available, falls back to type string.
 */
function getTypeId(type: TS.Type, typeChecker: TS.TypeChecker): string {
  // TypeScript types have an internal `id` property
  const internalId = (type as { id?: number }).id;
  if (internalId !== undefined) {
    return `id:${internalId}`;
  }
  // Fallback to type string representation
  return `str:${typeChecker.typeToString(type)}`;
}

/**
 * Collect all referenced types from a type and add them to the tracking set
 */
export function collectReferencedTypes(
  type: TS.Type,
  typeChecker: TS.TypeChecker,
  referencedTypes: Set<string>,
  visitedTypeIds: Set<string> = new Set(),
): void {
  // Use type ID for cycle detection instead of object identity
  const typeId = getTypeId(type, typeChecker);
  if (visitedTypeIds.has(typeId)) return;
  visitedTypeIds.add(typeId);

  // Get the symbol for this type
  const symbol = type.getSymbol();
  if (symbol) {
    const symbolName = symbol.getName();

    // Skip anonymous types (starts with __) and built-ins
    if (!symbolName.startsWith('__') && !isBuiltInTypeName(symbolName)) {
      referencedTypes.add(symbolName);
    }
  }

  // Handle intersection types (A & B)
  if (type.isIntersection()) {
    for (const intersectionType of (type as TS.IntersectionType).types) {
      collectReferencedTypes(intersectionType, typeChecker, referencedTypes, visitedTypeIds);
    }
  }

  // Handle union types (A | B)
  if (type.isUnion()) {
    for (const unionType of (type as TS.UnionType).types) {
      collectReferencedTypes(unionType, typeChecker, referencedTypes, visitedTypeIds);
    }
  }

  // Handle generic type references
  if (type.flags & ts.TypeFlags.Object) {
    const objectType = type as TS.ObjectType;
    if (objectType.objectFlags & ts.ObjectFlags.Reference) {
      const typeRef = objectType as TS.TypeReference;
      if (typeRef.typeArguments) {
        for (const typeArg of typeRef.typeArguments) {
          collectReferencedTypes(typeArg, typeChecker, referencedTypes, visitedTypeIds);
        }
      }
    }
  }
}

/**
 * Recursively walk a type syntax node to record every named alias it touches.
 * This complements `collectReferencedTypes`, which operates on checker types
 * and may omit aliases that get flattened during type resolution.
 */
export function collectReferencedTypesFromNode(
  node: TS.TypeNode,
  typeChecker: TS.TypeChecker,
  referencedTypes: Set<string>,
): void {
  if (ts.isTypeReferenceNode(node)) {
    const typeNameText = node.typeName.getText();
    const symbol = typeChecker.getSymbolAtLocation(node.typeName);
    const name = symbol?.getName() ?? typeNameText;
    if (!isBuiltInTypeName(name)) {
      referencedTypes.add(name);
    }
    node.typeArguments?.forEach((arg) =>
      collectReferencedTypesFromNode(arg, typeChecker, referencedTypes),
    );
    return;
  }

  if (ts.isExpressionWithTypeArguments(node)) {
    const expressionText = node.expression.getText();
    const symbol = typeChecker.getSymbolAtLocation(node.expression);
    const name = symbol?.getName() ?? expressionText;
    if (!isBuiltInTypeName(name)) {
      referencedTypes.add(name);
    }
    node.typeArguments?.forEach((arg) =>
      collectReferencedTypesFromNode(arg, typeChecker, referencedTypes),
    );
    return;
  }

  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    node.types.forEach((typeNode) =>
      collectReferencedTypesFromNode(typeNode, typeChecker, referencedTypes),
    );
    return;
  }

  if (ts.isArrayTypeNode(node)) {
    collectReferencedTypesFromNode(node.elementType, typeChecker, referencedTypes);
    return;
  }

  if (ts.isParenthesizedTypeNode(node)) {
    collectReferencedTypesFromNode(node.type, typeChecker, referencedTypes);
    return;
  }

  if (ts.isTypeLiteralNode(node)) {
    node.members.forEach((member) => {
      if (ts.isPropertySignature(member) && member.type) {
        collectReferencedTypesFromNode(member.type, typeChecker, referencedTypes);
      }
      if (ts.isMethodSignature(member)) {
        member.typeParameters?.forEach((param) => {
          param.constraint &&
            collectReferencedTypesFromNode(param.constraint, typeChecker, referencedTypes);
        });
        member.parameters.forEach((param) => {
          if (param.type) {
            collectReferencedTypesFromNode(param.type, typeChecker, referencedTypes);
          }
        });
        if (member.type) {
          collectReferencedTypesFromNode(member.type, typeChecker, referencedTypes);
        }
      }
      if (ts.isCallSignatureDeclaration(member) && member.type) {
        collectReferencedTypesFromNode(member.type, typeChecker, referencedTypes);
      }
      if (ts.isIndexSignatureDeclaration(member) && member.type) {
        collectReferencedTypesFromNode(member.type, typeChecker, referencedTypes);
      }
    });
    return;
  }

  if (ts.isTypeOperatorNode(node)) {
    collectReferencedTypesFromNode(node.type, typeChecker, referencedTypes);
    return;
  }

  if (ts.isIndexedAccessTypeNode(node)) {
    collectReferencedTypesFromNode(node.objectType, typeChecker, referencedTypes);
    collectReferencedTypesFromNode(node.indexType, typeChecker, referencedTypes);
    return;
  }

  if (ts.isLiteralTypeNode(node)) {
    return;
  }

  node.forEachChild((child: TS.Node) => {
    if (ts.isTypeNode(child)) {
      collectReferencedTypesFromNode(child, typeChecker, referencedTypes);
    }
  });
}
