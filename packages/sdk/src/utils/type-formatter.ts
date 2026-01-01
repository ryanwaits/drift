/**
 * Type formatting and reference generation.
 * Main entry point for converting TypeScript types to JSON Schema.
 */
import type * as TS from 'typescript';
import { DEFAULT_MAX_TYPE_DEPTH } from '../options';
import { ts } from '../ts-module';
import {
  BUILTIN_TYPE_SCHEMAS,
  deduplicateSchemas,
  findDiscriminatorProperty,
  setSchemaBuilderFormatTypeReference,
} from './schema-builder';
import { isBuiltInType } from './type-utils';
import {
  formatTypeBoxSchema,
  getPropertyType,
  isInternalProperty,
  isTypeBoxOptionalMarker,
  isTypeBoxSchemaType,
  setFormatTypeReference,
} from './typebox-handler';

/**
 * Safely convert a type to string, catching any stack overflow errors.
 */
function safeTypeToString(typeChecker: TS.TypeChecker, type: TS.Type): string {
  try {
    return typeChecker.typeToString(type);
  } catch {
    return 'unknown';
  }
}

/**
 * Format a type as either a string or a reference object
 * Following OpenAPI standards: use $ref for all named types
 *
 * @param type - The TypeScript type to format
 * @param typeChecker - The TypeScript type checker
 * @param typeRefs - Map of known type references
 * @param referencedTypes - Set to collect referenced type names
 * @param visitedAliases - Set of visited alias names to prevent cycles
 * @param depth - Current recursion depth
 * @param maxDepth - Maximum recursion depth (configurable, default 20)
 * @param visitedTypeIds - Set of visited type IDs to prevent cycles (TypeDoc pattern)
 */
export function formatTypeReference(
  type: TS.Type,
  typeChecker: TS.TypeChecker,
  typeRefs: Map<string, string>,
  referencedTypes?: Set<string>,
  visitedAliases?: Set<string>,
  depth = 0,
  maxDepth: number = DEFAULT_MAX_TYPE_DEPTH,
  visitedTypeIds?: Set<number>,
): string | Record<string, unknown> {
  // Guard against infinite recursion via depth limit
  if (depth > maxDepth) {
    return { type: 'unknown' };
  }

  const visited = visitedAliases ?? new Set<string>();
  const typeIds = visitedTypeIds ?? new Set<number>();

  // TypeDoc pattern: track by type.id to catch anonymous recursive types
  // biome-ignore lint/suspicious/noExplicitAny: TypeScript internal type id not exposed in public API
  const typeId = (type as any).id as number | undefined;
  if (typeId !== undefined) {
    if (typeIds.has(typeId)) {
      // Already processing this exact type instance - break cycle
      return { type: 'unknown' };
    }
    typeIds.add(typeId);
  }

  const aliasSymbol = type.aliasSymbol;
  let aliasName: string | undefined;
  let aliasAdded = false;

  if (aliasSymbol) {
    aliasName = aliasSymbol.getName();

    if (visited.has(aliasName)) {
      return { $ref: `#/types/${aliasName}` };
    }

    if (typeRefs.has(aliasName)) {
      return { $ref: `#/types/${aliasName}` };
    }

    if (referencedTypes && !isBuiltInType(aliasName)) {
      referencedTypes.add(aliasName);
      return { $ref: `#/types/${aliasName}` };
    }

    visited.add(aliasName);
    aliasAdded = true;
  }

  try {
    const typeString = safeTypeToString(typeChecker, type);

    // Check if this is a primitive type
    const primitives = [
      'string',
      'number',
      'boolean',
      'bigint',
      'symbol',
      'any',
      'unknown',
      'void',
      'undefined',
      'null',
      'never',
    ];
    if (primitives.includes(typeString)) {
      // Convert to OpenAPI schema format
      if (typeString === 'bigint') {
        return { type: 'string', format: 'bigint' };
      }
      if (typeString === 'undefined' || typeString === 'null') {
        return { type: 'null' };
      }
      if (typeString === 'void' || typeString === 'never') {
        return { type: 'null' }; // Best approximation
      }
      return { type: typeString };
    }

    // Handle mapped types (e.g., { readonly [K in keyof T]: T[K] })
    if (type.getFlags() & ts.TypeFlags.Object) {
      const objectType = type as TS.ObjectType;
      if (objectType.objectFlags & ts.ObjectFlags.Mapped) {
        // Mapped types can't be fully represented in JSON Schema
        return { type: 'object' };
      }
    }

    // Handle conditional types (e.g., T extends U ? X : Y)
    if (type.flags & ts.TypeFlags.Conditional) {
      // Conditional types can't be fully represented in JSON Schema
      return { type: 'object' };
    }

    // Handle union types (e.g., "A | B | undefined")
    if (type.isUnion()) {
      const unionType = type as TS.UnionType;
      const parts = unionType.types.map((t) =>
        formatTypeReference(
          t,
          typeChecker,
          typeRefs,
          referencedTypes,
          visited,
          depth + 1,
          maxDepth,
          typeIds,
        ),
      );

      // Deduplicate (e.g., null and undefined both become { type: 'null' })
      const uniqueParts = deduplicateSchemas(parts);

      // If only one unique part remains, return it directly (unwrap single-item anyOf)
      if (uniqueParts.length === 1) {
        return uniqueParts[0];
      }

      // Check for discriminator property (tagged union pattern)
      const discriminatorProp = findDiscriminatorProperty(unionType.types, typeChecker);

      if (discriminatorProp) {
        return {
          anyOf: uniqueParts,
          discriminator: { propertyName: discriminatorProp },
        };
      }

      // Return as an anyOf array (OpenAPI style)
      return {
        anyOf: uniqueParts,
      };
    }

    if (type.isIntersection()) {
      const intersectionType = type as TS.IntersectionType;

      // Filter out TypeBox OptionalKind marker types
      const filteredTypes = intersectionType.types.filter((t) => !isTypeBoxOptionalMarker(t));

      // If only one type remains after filtering, unwrap
      if (filteredTypes.length === 1) {
        return formatTypeReference(
          filteredTypes[0],
          typeChecker,
          typeRefs,
          referencedTypes,
          visited,
          depth + 1,
          maxDepth,
          typeIds,
        );
      }

      if (filteredTypes.length === 0) {
        return { type: 'object' };
      }

      const parts = filteredTypes.map((t) =>
        formatTypeReference(
          t,
          typeChecker,
          typeRefs,
          referencedTypes,
          visited,
          depth + 1,
          maxDepth,
          typeIds,
        ),
      );

      const normalized = parts.flatMap((part) => {
        if (typeof part === 'string') {
          return [{ type: part }];
        }

        if (part && typeof part === 'object' && 'allOf' in part) {
          return Array.isArray(part.allOf) ? part.allOf : [part];
        }

        return [part];
      });

      if (normalized.length === 1) {
        return normalized[0];
      }

      return {
        allOf: normalized,
      };
    }

    // Check if this is a known type
    const symbol = type.getSymbol();
    if (symbol) {
      const symbolName = symbol.getName();

      // Handle anonymous types (TypeScript uses __type, __object, etc. for anonymous types)
      if (symbolName.startsWith('__')) {
        // Try to expand anonymous types inline
        if (type.getFlags() & ts.TypeFlags.Object) {
          const properties = type.getProperties();
          if (properties.length > 0) {
            // Build inline object schema
            const objSchema: {
              type: 'object';
              properties: Record<string, unknown>;
              required?: string[];
            } = {
              type: 'object',
              properties: {},
            };
            const required: string[] = [];

            for (const prop of properties) {
              const propName = prop.getName();

              if (isInternalProperty(propName)) {
                continue;
              }

              const propType = getPropertyType(prop, type, typeChecker);

              objSchema.properties[propName] = formatTypeReference(
                propType,
                typeChecker,
                typeRefs,
                referencedTypes,
                visited,
                depth + 1,
                maxDepth,
                typeIds,
              );

              if (!(prop.flags & ts.SymbolFlags.Optional)) {
                required.push(propName);
              }
            }

            if (required.length > 0) {
              objSchema.required = required;
            }

            return objSchema;
          }
        }
        // If we can't expand it, return a generic object
        return { type: 'object' };
      }
      // Check if this type is in our current package's types
      if (typeRefs.has(symbolName)) {
        // Handle generic type references with typeArguments
        const typeArgs = (type as TS.TypeReference).typeArguments;
        if (typeArgs && typeArgs.length > 0) {
          return {
            $ref: `#/types/${symbolName}`,
            typeArguments: typeArgs.map((arg) =>
              formatTypeReference(
                arg,
                typeChecker,
                typeRefs,
                referencedTypes,
                visited,
                depth + 1,
                maxDepth,
                typeIds,
              ),
            ),
          };
        }
        return { $ref: `#/types/${symbolName}` };
      }

      // For built-in generic types (Array, Promise, Map, etc.)
      const typeArgs = (type as TS.TypeReference).typeArguments;
      if (symbolName === 'Array' || symbolName === 'ReadonlyArray') {
        if (typeArgs && typeArgs.length > 0) {
          return {
            type: 'array',
            items: formatTypeReference(
              typeArgs[0],
              typeChecker,
              typeRefs,
              referencedTypes,
              visited,
              depth + 1,
              maxDepth,
              typeIds,
            ),
          };
        }
        return { type: 'array' };
      }

      // Built-in generics that should use $ref + typeArguments
      const BUILTIN_GENERICS = new Set([
        'Promise',
        'PromiseLike',
        'Map',
        'Set',
        'WeakMap',
        'WeakSet',
        'Partial',
        'Required',
        'Readonly',
        'Pick',
        'Omit',
        'Record',
        'Exclude',
        'Extract',
        'NonNullable',
        'Awaited',
        'Iterable',
        'Iterator',
        'IterableIterator',
        'AsyncIterable',
        'AsyncIterator',
        'AsyncIterableIterator',
        'Generator',
        'AsyncGenerator',
      ]);

      if (BUILTIN_GENERICS.has(symbolName)) {
        if (typeArgs && typeArgs.length > 0) {
          return {
            $ref: symbolName,
            typeArguments: typeArgs.map((arg) =>
              formatTypeReference(
                arg,
                typeChecker,
                typeRefs,
                referencedTypes,
                visited,
                depth + 1,
                maxDepth,
                typeIds,
              ),
            ),
          };
        }
        return { $ref: symbolName };
      }

      const builtInSchema = BUILTIN_TYPE_SCHEMAS[symbolName];
      if (builtInSchema) {
        return { ...builtInSchema };
      }

      // Check for TypeBox schema types and extract their structure
      if (isTypeBoxSchemaType(symbolName)) {
        const typeBoxSchema = formatTypeBoxSchema(
          type,
          typeChecker,
          typeRefs,
          referencedTypes,
          visited,
          depth + 1,
        );
        if (typeBoxSchema) {
          return typeBoxSchema;
        }
      }

      // Add to referenced types for potential collection
      if (referencedTypes && !isBuiltInType(symbolName)) {
        referencedTypes.add(symbolName);
        return { $ref: `#/types/${symbolName}` };
      }

      if (isBuiltInType(symbolName)) {
        return { type: 'object' };
      }

      // For types not in our package, still use $ref
      return { $ref: `#/types/${symbolName}` };
    }

    // Handle literal types (e.g., "mainnet")
    if (type.isLiteral()) {
      // TypeScript returns string literals with quotes, so we need to parse them
      if (typeString.startsWith('"') && typeString.endsWith('"')) {
        const literalValue = typeString.slice(1, -1); // Remove surrounding quotes
        return { enum: [literalValue] };
      }
      // Number literal
      return { enum: [Number(typeString)] };
    }

    // For complex types without symbols, parse the string to find references
    // This handles cases like "ClientOpts | undefined"
    const typePattern = /^(\w+)(\s*\|\s*undefined)?$/;
    const match = typeString.match(typePattern);
    if (match) {
      const [, typeName, hasUndefined] = match;
      if (typeRefs.has(typeName) || !isBuiltInType(typeName)) {
        if (hasUndefined) {
          return {
            anyOf: [{ $ref: `#/types/${typeName}` }, { type: 'null' }],
          };
        }
        return { $ref: `#/types/${typeName}` };
      }
    }

    // Default: return as complex type string
    return { type: typeString };
  } finally {
    if (aliasAdded && aliasName) {
      visited.delete(aliasName);
    }
    // Clean up type ID tracking (like TypeDoc does)
    if (typeId !== undefined) {
      typeIds.delete(typeId);
    }
  }
}

// Register formatTypeReference with dependent modules
setFormatTypeReference(formatTypeReference);
setSchemaBuilderFormatTypeReference(formatTypeReference);
