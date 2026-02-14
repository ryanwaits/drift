/**
 * Maps ClarityType → ApiSchema.
 */
import type { ClarityType } from '@secondlayer/clarity-types';
import type { ApiSchema } from '@driftdev/sdk/types';

/**
 * Convert a ClarityType to a drift ApiSchema.
 * Handles all primitive and composite types recursively.
 */
export function clarityTypeToSchema(type: ClarityType): ApiSchema {
  // Primitive string types
  if (typeof type === 'string') {
    return type; // "uint128" | "int128" | "bool" | "principal" | "trait_reference"
  }

  // Buffer
  if ('buff' in type) {
    return { type: 'buffer', maxLength: type.buff.length };
  }

  // String ASCII
  if ('string-ascii' in type) {
    return { type: 'string', format: 'ascii', maxLength: type['string-ascii'].length };
  }

  // String UTF-8
  if ('string-utf8' in type) {
    return { type: 'string', format: 'utf8', maxLength: type['string-utf8'].length };
  }

  // List
  if ('list' in type) {
    return {
      type: 'array',
      items: clarityTypeToSchema(type.list.type),
      maxItems: type.list.length,
    };
  }

  // Tuple
  if ('tuple' in type) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const field of type.tuple) {
      properties[field.name] = clarityTypeToSchema(field.type);
      required.push(field.name);
    }
    return { type: 'object', properties, required };
  }

  // Optional
  if ('optional' in type) {
    return { anyOf: [clarityTypeToSchema(type.optional), { type: 'null' }] };
  }

  // Response
  if ('response' in type) {
    return {
      type: 'response',
      ok: clarityTypeToSchema(type.response.ok),
      error: clarityTypeToSchema(type.response.error),
    };
  }

  return 'unknown';
}
