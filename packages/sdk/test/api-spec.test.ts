import { describe, expect, test } from 'bun:test';
import type { ApiSpec } from '../src/analysis/api-spec';
import { computeDrift } from '../src/analysis/drift/compute';
import { toApiSpec } from '../src/analysis/spec-types';

describe('ApiSpec', () => {
  describe('hand-crafted ApiSpec → computeDrift', () => {
    test('detects param mismatch from a pure ApiSpec (no OpenPkg)', () => {
      const spec: ApiSpec = {
        meta: { name: 'my-lib' },
        exports: [
          {
            id: 'greet',
            name: 'greet',
            kind: 'function',
            description: 'Say hello',
            tags: [{ name: 'param', text: 'userName', param: { name: 'userName' } }],
            signatures: [
              {
                parameters: [{ name: 'name', schema: 'string' }],
                returns: { schema: 'void' },
              },
            ],
          },
        ],
      };

      const result = computeDrift(spec);
      const drifts = result.exports.get('greet') ?? [];
      expect(drifts.length).toBeGreaterThan(0);
      expect(drifts[0].type).toBe('param-mismatch');
      expect(drifts[0].target).toBe('userName');
    });

    test('no drift for clean ApiSpec', () => {
      const spec: ApiSpec = {
        meta: { name: 'clean-lib', version: '1.0.0' },
        exports: [
          {
            id: 'add',
            name: 'add',
            kind: 'function',
            description: 'Add two numbers',
            tags: [
              { name: 'param', text: 'a', param: { name: 'a' } },
              { name: 'param', text: 'b', param: { name: 'b' } },
            ],
            signatures: [
              {
                parameters: [
                  { name: 'a', schema: 'number' },
                  { name: 'b', schema: 'number' },
                ],
                returns: { schema: 'number' },
              },
            ],
          },
        ],
      };

      const result = computeDrift(spec);
      const drifts = result.exports.get('add') ?? [];
      expect(drifts).toEqual([]);
    });

    test('registry resolves types from ApiSpec', () => {
      const spec: ApiSpec = {
        meta: { name: 'typed-lib' },
        exports: [
          {
            id: 'createFoo',
            name: 'createFoo',
            kind: 'function',
            description: 'Creates a Foo. See {@link Foo}',
            signatures: [{ returns: { schema: 'Foo' } }],
          },
        ],
        types: [
          {
            id: 'Foo',
            name: 'Foo',
            kind: 'interface',
            schema: { type: 'object', properties: { bar: 'string' } },
          },
        ],
      };

      const result = computeDrift(spec);
      const drifts = result.exports.get('createFoo') ?? [];
      // {@link Foo} should NOT be broken because Foo is in types
      const brokenLinks = drifts.filter((d) => d.type === 'broken-link');
      expect(brokenLinks).toEqual([]);
    });
  });

  describe('toApiSpec', () => {
    test('preserves all fields from an OpenPkg fixture', () => {
      const openpkg = {
        openpkg: '0.4.0' as const,
        meta: { name: 'test-pkg', version: '2.0.0', description: 'A test' },
        exports: [
          {
            id: 'fn1',
            name: 'fn1',
            kind: 'function' as const,
            description: 'A function',
            tags: [{ name: 'param', text: 'x', param: { name: 'x', type: 'number' } }],
            signatures: [
              {
                parameters: [{ name: 'x', schema: { type: 'number' } }],
                returns: { schema: { type: 'string' } },
              },
            ],
            examples: ['```ts\nfn1(1);\n```'],
            deprecated: false,
            source: { file: 'src/index.ts', line: 10 },
            flags: { async: true },
          },
        ],
        types: [
          {
            id: 'MyType',
            name: 'MyType',
            kind: 'interface' as const,
            description: 'A type',
            schema: { type: 'object', properties: { a: { type: 'string' } } },
            members: [{ name: 'a', kind: 'property' }],
            source: { file: 'src/types.ts', line: 5 },
            tags: [{ name: 'since', text: '1.0.0' }],
          },
        ],
      };

      const apiSpec = toApiSpec(openpkg);

      expect(apiSpec.meta.name).toBe('test-pkg');
      expect(apiSpec.meta.version).toBe('2.0.0');
      expect(apiSpec.exports).toHaveLength(1);
      expect(apiSpec.exports[0].id).toBe('fn1');
      expect(apiSpec.exports[0].name).toBe('fn1');
      expect(apiSpec.exports[0].description).toBe('A function');
      expect(apiSpec.exports[0].tags).toHaveLength(1);
      expect(apiSpec.exports[0].signatures).toHaveLength(1);
      expect(apiSpec.exports[0].examples).toHaveLength(1);
      expect(apiSpec.exports[0].source?.file).toBe('src/index.ts');
      expect(apiSpec.exports[0].flags?.async).toBe(true);
      expect(apiSpec.types).toHaveLength(1);
      expect(apiSpec.types![0].name).toBe('MyType');
      expect(apiSpec.types![0].members).toHaveLength(1);
      expect(apiSpec.types![0].tags).toHaveLength(1);
    });

    test('handles missing optional fields', () => {
      const openpkg = {
        openpkg: '0.4.0' as const,
        meta: { name: 'minimal' },
        exports: [{ id: 'x', name: 'x', kind: 'variable' as const }],
      };

      const apiSpec = toApiSpec(openpkg);
      expect(apiSpec.meta.name).toBe('minimal');
      expect(apiSpec.meta.version).toBeUndefined();
      expect(apiSpec.types).toBeUndefined();
      expect(apiSpec.exports).toHaveLength(1);
    });
  });
});
