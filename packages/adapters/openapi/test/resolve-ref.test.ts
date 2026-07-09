import { describe, expect, test } from 'bun:test';
import { deepResolve, resolveRef } from '../src/resolve-ref';
import type { OpenApiDocument } from '../src/types';

function doc(schemas: Record<string, Record<string, unknown>>): OpenApiDocument {
  return { openapi: '3.1.0', info: { title: 't' }, components: { schemas } };
}

describe('resolveRef', () => {
  test('resolves a components/schemas pointer', () => {
    const d = doc({ Pet: { type: 'object' } });
    expect(resolveRef(d, '#/components/schemas/Pet')).toEqual({ type: 'object' });
  });

  test('unescapes JSON pointer segments (~0, ~1)', () => {
    const d = doc({ 'a/b': { type: 'string' }, 'c~d': { type: 'integer' } });
    expect(resolveRef(d, '#/components/schemas/a~1b')).toEqual({ type: 'string' });
    expect(resolveRef(d, '#/components/schemas/c~0d')).toEqual({ type: 'integer' });
  });

  test('throws on dangling local ref', () => {
    expect(() => resolveRef(doc({}), '#/components/schemas/Nope')).toThrow('Unresolvable $ref');
  });

  test('throws on non-local ref', () => {
    expect(() => resolveRef(doc({}), 'other.json#/Pet')).toThrow('Only local $refs');
  });
});

describe('deepResolve', () => {
  test('resolves nested refs', () => {
    const d = doc({
      Outer: { type: 'object', properties: { inner: { $ref: '#/components/schemas/Inner' } } },
      Inner: { type: 'string' },
    });
    const resolved = deepResolve(d, { $ref: '#/components/schemas/Outer' }) as Record<string, any>;
    expect(resolved.properties.inner).toEqual({ type: 'string' });
  });

  test('breaks cycles by leaving inner $ref in place', () => {
    const d = doc({
      Node: {
        type: 'object',
        properties: { next: { $ref: '#/components/schemas/Node' } },
      },
    });
    const resolved = deepResolve(d, { $ref: '#/components/schemas/Node' }) as Record<string, any>;
    expect(resolved.type).toBe('object');
    expect(resolved.properties.next).toEqual({ $ref: '#/components/schemas/Node' });
  });

  test('sibling keys merge over resolved target (3.1)', () => {
    const d = doc({ Base: { type: 'string', description: 'base desc' } });
    const resolved = deepResolve(d, {
      $ref: '#/components/schemas/Base',
      description: 'override desc',
    });
    expect(resolved).toEqual({ type: 'string', description: 'override desc' });
  });

  test('non-local refs pass through untouched', () => {
    const d = doc({});
    const node = { $ref: 'https://example.com/pet.json#/Pet' };
    expect(deepResolve(d, node)).toEqual(node);
  });

  test('arrays and primitives pass through', () => {
    const d = doc({ S: { type: 'string' } });
    expect(deepResolve(d, [{ $ref: '#/components/schemas/S' }, 42, null])).toEqual([
      { type: 'string' },
      42,
      null,
    ]);
  });
});
