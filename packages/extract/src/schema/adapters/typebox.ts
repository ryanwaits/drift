/**
 * TypeBox Schema Adapter
 *
 * Extracts output types from TypeBox schemas via the static property.
 */
import type * as TS from 'typescript';
import type { SchemaAdapter } from '../registry';

/**
 * Pattern to match TypeBox type names.
 * Examples: TString, TNumber, TObject, TArray, etc.
 */
const TYPEBOX_TYPE_PATTERN = /^T[A-Z]/;

export const typeboxAdapter: SchemaAdapter = {
  id: 'typebox',
  packages: ['@sinclair/typebox'],

  matches(type: TS.Type, checker: TS.TypeChecker): boolean {
    const typeName = checker.typeToString(type);

    // Must start with T followed by uppercase letter
    // Additional check: should have 'type' property (JSON Schema)
    if (!TYPEBOX_TYPE_PATTERN.test(typeName)) {
      return false;
    }

    // Verify it's a TypeBox schema by checking for characteristic property
    const typeProperty = type.getProperty('type');
    return typeProperty !== undefined;
  },

  extractOutputType(type: TS.Type, checker: TS.TypeChecker): TS.Type | null {
    // TypeBox schemas have 'static' property containing the TypeScript type
    const staticSymbol = type.getProperty('static');
    if (staticSymbol) {
      return checker.getTypeOfSymbol(staticSymbol);
    }

    return null;
  },

  // TypeBox doesn't have separate input/output types
};
