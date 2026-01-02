/**
 * Zod Schema Adapter
 *
 * Extracts output types from Zod schemas via the _output property.
 */
import type * as TS from 'typescript';
import type { SchemaAdapter } from '../registry';

/**
 * Pattern to match Zod type names.
 * Examples: ZodString, ZodNumber, ZodObject, ZodArray, etc.
 */
const ZOD_TYPE_PATTERN = /^Zod[A-Z]/;

export const zodAdapter: SchemaAdapter = {
  id: 'zod',
  packages: ['zod'],

  matches(type: TS.Type, checker: TS.TypeChecker): boolean {
    const typeName = checker.typeToString(type);
    return ZOD_TYPE_PATTERN.test(typeName);
  },

  extractOutputType(type: TS.Type, checker: TS.TypeChecker): TS.Type | null {
    // Zod schemas have _output property containing the inferred output type
    const outputSymbol = type.getProperty('_output');
    if (outputSymbol) {
      return checker.getTypeOfSymbol(outputSymbol);
    }

    // Fallback: try _type (older Zod versions)
    const typeSymbol = type.getProperty('_type');
    if (typeSymbol) {
      return checker.getTypeOfSymbol(typeSymbol);
    }

    return null;
  },

  extractInputType(type: TS.Type, checker: TS.TypeChecker): TS.Type | null {
    // Zod schemas have _input property for the input type (before transforms)
    const inputSymbol = type.getProperty('_input');
    if (inputSymbol) {
      return checker.getTypeOfSymbol(inputSymbol);
    }
    return null;
  },
};
