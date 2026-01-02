/**
 * Valibot Schema Adapter
 *
 * Extracts output types from Valibot schemas via the ~types.output property.
 */
import type * as TS from 'typescript';
import type { SchemaAdapter } from '../registry';
import { getNonNullableType } from '../registry';

/**
 * Pattern to match Valibot type names.
 * Examples: ObjectSchema, ArraySchema, StringSchema, etc.
 * Excludes Zod types which also contain "Schema".
 */
const VALIBOT_TYPE_PATTERN = /Schema(<|$)/;

export const valibotAdapter: SchemaAdapter = {
  id: 'valibot',
  packages: ['valibot'],

  matches(type: TS.Type, checker: TS.TypeChecker): boolean {
    const typeName = checker.typeToString(type);

    // Must match schema pattern and NOT be a Zod type
    return VALIBOT_TYPE_PATTERN.test(typeName) && !typeName.includes('Zod');
  },

  extractOutputType(type: TS.Type, checker: TS.TypeChecker): TS.Type | null {
    // Valibot schemas have ~types property with { input, output, issue }
    const typesSymbol = type.getProperty('~types');
    if (!typesSymbol) {
      return null;
    }

    // Get the ~types type (may be { ... } | undefined)
    let typesType = checker.getTypeOfSymbol(typesSymbol);

    // Remove undefined from union
    typesType = getNonNullableType(typesType);

    // Get the output property
    const outputSymbol = typesType.getProperty('output');
    if (!outputSymbol) {
      return null;
    }

    return checker.getTypeOfSymbol(outputSymbol);
  },

  extractInputType(type: TS.Type, checker: TS.TypeChecker): TS.Type | null {
    const typesSymbol = type.getProperty('~types');
    if (!typesSymbol) {
      return null;
    }

    let typesType = checker.getTypeOfSymbol(typesSymbol);
    typesType = getNonNullableType(typesType);

    const inputSymbol = typesType.getProperty('input');
    if (!inputSymbol) {
      return null;
    }

    return checker.getTypeOfSymbol(inputSymbol);
  },
};
