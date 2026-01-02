/**
 * ArkType Schema Adapter
 *
 * Extracts output types from ArkType schemas via type arguments.
 * ArkType is the simplest - output type is directly in generic parameter.
 */
import type * as TS from 'typescript';
import type { SchemaAdapter } from '../registry';
import { isTypeReference } from '../registry';

/**
 * Pattern to match ArkType type names.
 * ArkType uses Type<Output, Input> format.
 */
const ARKTYPE_TYPE_PATTERN = /^Type</;

export const arktypeAdapter: SchemaAdapter = {
  id: 'arktype',
  packages: ['arktype'],

  matches(type: TS.Type, checker: TS.TypeChecker): boolean {
    const typeName = checker.typeToString(type);
    return ARKTYPE_TYPE_PATTERN.test(typeName);
  },

  extractOutputType(type: TS.Type, checker: TS.TypeChecker): TS.Type | null {
    // ArkType: Type<Output, Input>
    // Output is directly at type argument index 0
    if (!isTypeReference(type)) {
      return null;
    }

    const args = checker.getTypeArguments(type);
    if (args.length < 1) {
      return null;
    }

    return args[0];
  },

  extractInputType(type: TS.Type, checker: TS.TypeChecker): TS.Type | null {
    // ArkType: Type<Output, Input>
    // Input is at type argument index 1
    if (!isTypeReference(type)) {
      return null;
    }

    const args = checker.getTypeArguments(type);
    if (args.length < 2) {
      return null;
    }

    return args[1];
  },
};
