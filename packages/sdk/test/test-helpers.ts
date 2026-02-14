/**
 * Shared test fixtures and helpers for SDK tests.
 *
 * These helpers produce loose shapes that are structurally compatible with
 * both ApiSpec/ApiExport (drift analysis) and OpenPkg/SpecExport (diffSpec).
 * Extra fields beyond the type contract are harmless at runtime.
 */
import type { ApiExport, ApiSpec } from '../src/analysis/api-spec';
import type { SpecDocDrift } from '../src/analysis/drift/types';

/**
 * Create a minimal valid spec for testing.
 * Includes openpkg-specific fields for compatibility with diffSpec() tests.
 */
export function createSpec(overrides: Record<string, unknown> = {}): ApiSpec {
  return {
    openpkg: '0.9.0',
    meta: { name: 'test-pkg', version: '1.0.0' },
    exports: [],
    types: [],
    ...overrides,
  } as ApiSpec;
}

/**
 * Create a spec export for testing.
 */
export function createExport(overrides: Record<string, unknown> = {}): ApiExport {
  const name = (overrides.name as string) ?? 'testFn';
  return {
    id: name,
    name,
    kind: 'function',
    ...overrides,
  } as ApiExport;
}

/**
 * Create a function export with full documentation.
 */
export function createDocumentedFunction(
  name: string,
  options: {
    description?: string;
    examples?: string[];
    params?: Array<{ name: string; type: string; description?: string }>;
    returnType?: string;
  } = {},
): ApiExport {
  return {
    id: name,
    name,
    kind: 'function',
    description: options.description,
    examples: options.examples,
    signatures: options.params
      ? [
          {
            parameters: options.params.map((p) => ({
              name: p.name,
              schema: { type: p.type },
              description: p.description,
            })),
            returns: options.returnType ? { schema: { type: options.returnType } } : undefined,
          },
        ]
      : undefined,
  } as ApiExport;
}

/**
 * Create a class export for testing.
 */
export function createClassExport(
  name: string,
  options: {
    description?: string;
    methods?: Array<{ name: string; signature: string }>;
    properties?: Array<{ name: string; type: string }>;
  } = {},
): ApiExport {
  return {
    id: name,
    name,
    kind: 'class',
    description: options.description,
    members: [
      ...(options.methods?.map((m) => ({
        id: `${name}.${m.name}`,
        name: m.name,
        kind: 'method' as const,
      })) ?? []),
      ...(options.properties?.map((p) => ({
        name: p.name,
        kind: 'property' as const,
        schema: { type: p.type },
      })) ?? []),
    ],
  } as ApiExport;
}

/**
 * Create a drift issue for testing.
 */
export function createDrift(overrides: Partial<SpecDocDrift> = {}): SpecDocDrift {
  return {
    type: 'param-mismatch',
    issue: 'Test drift issue',
    ...overrides,
  };
}

/**
 * Create an enriched spec with docs metadata.
 */
export function createEnrichedSpec(
  options: {
    coverageScore?: number;
    exports?: ApiExport[];
    missing?: string[];
    drift?: SpecDocDrift[];
  } = {},
): ApiSpec & { docs?: { coverageScore: number; missing?: string[]; drift?: SpecDocDrift[] } } {
  const spec = createSpec({ exports: options.exports ?? [] });
  return {
    ...spec,
    docs: {
      coverageScore: options.coverageScore ?? 100,
      missing: options.missing,
      drift: options.drift,
    },
  };
}

/**
 * Schema fixtures for formatTypeReference tests.
 */
export const SCHEMA_FIXTURES = {
  primitives: {
    string: { type: 'string' },
    number: { type: 'number' },
    boolean: { type: 'boolean' },
    null: { type: 'null' },
    any: { type: 'any' },
    unknown: { type: 'unknown' },
  },
  complex: {
    array: { type: 'array', items: { type: 'string' } },
    object: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    },
    union: { anyOf: [{ type: 'string' }, { type: 'number' }] },
    intersection: { allOf: [{ type: 'object' }, { type: 'object' }] },
  },
  refs: {
    simple: { $ref: '#/types/User' },
    nullable: { anyOf: [{ $ref: '#/types/User' }, { type: 'null' }] },
  },
};

/**
 * Cache test fixtures.
 */
export const CACHE_FIXTURES = {
  validConfig: {
    resolveExternalTypes: false,
  },
  changedConfig: {
    resolveExternalTypes: true,
  },
};
