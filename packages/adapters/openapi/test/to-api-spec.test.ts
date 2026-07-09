import { describe, expect, test } from 'bun:test';
import { toApiSpec } from '../src/to-api-spec';
import type { OpenApiDocument } from '../src/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minimalDoc(overrides?: Partial<OpenApiDocument>): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: { title: 'test-api', version: '2.0.0' },
    paths: {},
    ...overrides,
  };
}

// ─── Meta ────────────────────────────────────────────────────────────────────

describe('toApiSpec — meta', () => {
  test('name/version from info', () => {
    const spec = toApiSpec(minimalDoc());
    expect(spec.meta.name).toBe('test-api');
    expect(spec.meta.version).toBe('2.0.0');
  });

  test('explicit meta overrides info', () => {
    const spec = toApiSpec(minimalDoc(), { name: 'override', version: '9.9.9' });
    expect(spec.meta.name).toBe('override');
    expect(spec.meta.version).toBe('9.9.9');
  });

  test('rejects non-3.x documents', () => {
    expect(() => toApiSpec(minimalDoc({ openapi: '2.0' }))).toThrow('Unsupported OpenAPI version');
  });
});

// ─── Operations ──────────────────────────────────────────────────────────────

describe('toApiSpec — operations', () => {
  test('operation with operationId, description, tags', () => {
    const spec = toApiSpec(
      minimalDoc({
        paths: {
          '/users.list': {
            post: {
              operationId: 'usersList',
              summary: 'users.list',
              description: 'Lists all users.',
              tags: ['User'],
              responses: { '200': { description: 'ok' } },
            },
          },
        },
      }),
    );

    expect(spec.exports).toHaveLength(1);
    const exp = spec.exports[0];
    expect(exp.id).toBe('usersList');
    expect(exp.name).toBe('usersList');
    expect(exp.kind).toBe('function');
    expect(exp.description).toBe('Lists all users.');
    expect(exp.flags).toEqual({ method: 'POST', path: '/users.list', tags: ['User'] });
    expect(exp.tags).toContainEqual({ name: 'summary', text: 'users.list' });
  });

  test('missing operationId falls back to METHOD path', () => {
    const spec = toApiSpec(minimalDoc({ paths: { '/pets': { get: { responses: {} } } } }));
    expect(spec.exports[0].name).toBe('GET /pets');
  });

  test('summary used as description when description missing', () => {
    const spec = toApiSpec(
      minimalDoc({ paths: { '/a': { get: { summary: 'Only summary', responses: {} } } } }),
    );
    expect(spec.exports[0].description).toBe('Only summary');
    expect(spec.exports[0].tags).toBeUndefined();
  });

  test('deprecated flag carries over', () => {
    const spec = toApiSpec(
      minimalDoc({ paths: { '/old': { get: { deprecated: true, responses: {} } } } }),
    );
    expect(spec.exports[0].deprecated).toBe(true);
  });

  test('non-deprecated operation leaves deprecated undefined', () => {
    const spec = toApiSpec(minimalDoc({ paths: { '/new': { get: { responses: {} } } } }));
    expect(spec.exports[0].deprecated).toBeUndefined();
  });
});

// ─── Parameters ──────────────────────────────────────────────────────────────

describe('toApiSpec — parameters', () => {
  test('query/path parameters map with required + description', () => {
    const spec = toApiSpec(
      minimalDoc({
        paths: {
          '/pets/{petId}': {
            parameters: [
              {
                name: 'petId',
                in: 'path',
                required: true,
                description: 'Pet id',
                schema: { type: 'string' },
              },
            ],
            get: {
              operationId: 'getPet',
              parameters: [{ name: 'verbose', in: 'query', schema: { type: 'boolean' } }],
              responses: {},
            },
          },
        },
      }),
    );

    const params = spec.exports[0].signatures?.[0].parameters ?? [];
    expect(params).toHaveLength(2);
    expect(params[0]).toEqual({
      name: 'petId',
      required: true,
      description: 'Pet id',
      schema: { type: 'string' },
    });
    expect(params[1].name).toBe('verbose');
    expect(params[1].required).toBe(false);
  });

  test('operation-level parameter overrides path-level with same name+in', () => {
    const spec = toApiSpec(
      minimalDoc({
        paths: {
          '/x': {
            parameters: [{ name: 'q', in: 'query', description: 'path-level' }],
            get: {
              parameters: [{ name: 'q', in: 'query', description: 'op-level' }],
              responses: {},
            },
          },
        },
      }),
    );
    const params = spec.exports[0].signatures?.[0].parameters ?? [];
    expect(params).toHaveLength(1);
    expect(params[0].description).toBe('op-level');
  });

  test('object requestBody flattens into named parameters', () => {
    const spec = toApiSpec(
      minimalDoc({
        paths: {
          '/candidate.info': {
            post: {
              operationId: 'candidateInfo',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['id'],
                      properties: {
                        id: { type: 'string', description: 'The candidate id' },
                        expand: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
              responses: {},
            },
          },
        },
      }),
    );

    const params = spec.exports[0].signatures?.[0].parameters ?? [];
    expect(params.map((p) => p.name)).toEqual(['id', 'expand']);
    expect(params[0].required).toBe(true);
    expect(params[0].description).toBe('The candidate id');
    expect(params[1].required).toBe(false);
  });

  test('$ref requestBody schema resolves before flattening', () => {
    const spec = toApiSpec(
      minimalDoc({
        components: {
          schemas: {
            Req: {
              type: 'object',
              properties: { name: { type: 'string', description: 'A name' } },
            },
          },
        },
        paths: {
          '/create': {
            post: {
              requestBody: {
                content: {
                  'application/json': { schema: { $ref: '#/components/schemas/Req' } },
                },
              },
              responses: {},
            },
          },
        },
      }),
    );
    const params = spec.exports[0].signatures?.[0].parameters ?? [];
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe('name');
    expect(params[0].description).toBe('A name');
  });

  test('non-object requestBody becomes single body parameter', () => {
    const spec = toApiSpec(
      minimalDoc({
        paths: {
          '/upload': {
            post: {
              requestBody: {
                required: true,
                description: 'Raw payload',
                content: { 'application/json': { schema: { type: 'string' } } },
              },
              responses: {},
            },
          },
        },
      }),
    );
    const params = spec.exports[0].signatures?.[0].parameters ?? [];
    expect(params).toEqual([
      { name: 'body', required: true, description: 'Raw payload', schema: { type: 'string' } },
    ]);
  });

  test('no synthetic @param tags (would false-positive JSDoc detectors)', () => {
    const spec = toApiSpec(
      minimalDoc({
        paths: {
          '/a': {
            get: {
              parameters: [
                { name: 'q', in: 'query', description: 'Search query', schema: { type: 'string' } },
              ],
              responses: {},
            },
          },
        },
      }),
    );
    expect(spec.exports[0].tags).toBeUndefined();
    expect(spec.exports[0].signatures?.[0].parameters?.[0].description).toBe('Search query');
  });
});

// ─── Responses ───────────────────────────────────────────────────────────────

describe('toApiSpec — responses', () => {
  test('lowest 2xx wins, description carried on returns', () => {
    const spec = toApiSpec(
      minimalDoc({
        paths: {
          '/a': {
            post: {
              responses: {
                '500': { description: 'boom' },
                '201': {
                  description: 'Created thing',
                  content: { 'application/json': { schema: { type: 'object' } } },
                },
                '200': {
                  description: 'OK thing',
                  content: { 'application/json': { schema: { type: 'string' } } },
                },
              },
            },
          },
        },
      }),
    );
    const returns = spec.exports[0].signatures?.[0].returns;
    expect(returns?.schema).toEqual({ type: 'string' });
    expect(returns?.description).toBe('OK thing');
  });

  test('oneOf [success, error] response resolves refs and carries through', () => {
    const spec = toApiSpec(
      minimalDoc({
        components: {
          schemas: {
            Ok: { type: 'object', properties: { success: { type: 'boolean' } } },
            Err: { type: 'object', properties: { errors: { type: 'array' } } },
          },
        },
        paths: {
          '/rpc.call': {
            post: {
              responses: {
                '200': {
                  description: 'RPC response',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf: [
                          { $ref: '#/components/schemas/Ok' },
                          { $ref: '#/components/schemas/Err' },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    );
    const schema = spec.exports[0].signatures?.[0].returns?.schema as Record<string, unknown>;
    const oneOf = schema.oneOf as Record<string, unknown>[];
    expect(oneOf).toHaveLength(2);
    expect(oneOf[0].properties).toEqual({ success: { type: 'boolean' } });
    expect(oneOf[1].properties).toEqual({ errors: { type: 'array' } });
  });

  test('response without JSON content → void schema', () => {
    const spec = toApiSpec(
      minimalDoc({
        paths: { '/d': { delete: { responses: { '204': { description: 'Deleted' } } } } },
      }),
    );
    expect(spec.exports[0].signatures?.[0].returns?.schema).toBe('void');
  });
});

// ─── Named schemas ───────────────────────────────────────────────────────────

describe('toApiSpec — components.schemas', () => {
  test('named schemas become ApiSpec.types', () => {
    const spec = toApiSpec(
      minimalDoc({
        components: {
          schemas: {
            Pet: { type: 'object', description: 'A pet', properties: { id: { type: 'string' } } },
          },
        },
      }),
    );
    expect(spec.types).toHaveLength(1);
    expect(spec.types?.[0]).toMatchObject({
      id: 'Pet',
      name: 'Pet',
      kind: 'type',
      description: 'A pet',
    });
  });

  test('no components → types undefined', () => {
    const spec = toApiSpec(minimalDoc());
    expect(spec.types).toBeUndefined();
  });
});
