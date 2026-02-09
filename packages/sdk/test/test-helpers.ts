/**
 * Shared test fixtures and helpers for SDK tests.
 */
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { SpecDocDrift } from '../src/analysis/drift/types';

/**
 * Create a minimal valid OpenPkg spec for testing.
 */
export function createSpec(overrides: Partial<OpenPkg> = {}): OpenPkg {
  return {
    openpkg: '0.9.0',
    name: 'test-pkg',
    version: '1.0.0',
    exports: [],
    types: [],
    ...overrides,
  };
}

/**
 * Create a spec export for testing.
 */
export function createExport(overrides: Partial<SpecExport> = {}): SpecExport {
  const name = overrides.name ?? 'testFn';
  return {
    id: name,
    name,
    kind: 'function',
    signature: `function ${name}(): void`,
    ...overrides,
  };
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
): SpecExport {
  return {
    id: name,
    name,
    kind: 'function',
    signature: `function ${name}(): ${options.returnType ?? 'void'}`,
    description: options.description,
    examples: options.examples,
    parameters: options.params?.map((p) => ({
      name: p.name,
      schema: { type: p.type },
      description: p.description,
    })),
    returnType: options.returnType ? { type: options.returnType } : undefined,
  };
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
): SpecExport {
  return {
    id: name,
    name,
    kind: 'class',
    signature: `class ${name}`,
    description: options.description,
    methods: options.methods?.map((m) => ({
      id: `${name}.${m.name}`,
      name: m.name,
      kind: 'method' as const,
      signature: m.signature,
    })),
    properties: options.properties?.map((p) => ({
      name: p.name,
      schema: { type: p.type },
    })),
  };
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
    exports?: SpecExport[];
    missing?: string[];
    drift?: SpecDocDrift[];
  } = {},
): OpenPkg & { docs?: { coverageScore: number; missing?: string[]; drift?: SpecDocDrift[] } } {
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
