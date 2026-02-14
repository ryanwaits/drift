import { describe, expect, test } from 'bun:test';
import type { ClarityType } from '@secondlayer/clarity-types';
import { clarityTypeToSchema } from '../src/type-mapping';

describe('clarityTypeToSchema', () => {
  // ─── Primitives ──────────────────────────────────────────────────────────

  test('uint128', () => {
    expect(clarityTypeToSchema('uint128')).toBe('uint128');
  });

  test('int128', () => {
    expect(clarityTypeToSchema('int128')).toBe('int128');
  });

  test('bool', () => {
    expect(clarityTypeToSchema('bool')).toBe('bool');
  });

  test('principal', () => {
    expect(clarityTypeToSchema('principal')).toBe('principal');
  });

  test('trait_reference', () => {
    expect(clarityTypeToSchema('trait_reference')).toBe('trait_reference');
  });

  // ─── Sized primitives ────────────────────────────────────────────────────

  test('buffer', () => {
    const type: ClarityType = { buff: { length: 32 } };
    expect(clarityTypeToSchema(type)).toEqual({ type: 'buffer', maxLength: 32 });
  });

  test('string-ascii', () => {
    const type: ClarityType = { 'string-ascii': { length: 50 } };
    expect(clarityTypeToSchema(type)).toEqual({
      type: 'string',
      format: 'ascii',
      maxLength: 50,
    });
  });

  test('string-utf8', () => {
    const type: ClarityType = { 'string-utf8': { length: 256 } };
    expect(clarityTypeToSchema(type)).toEqual({
      type: 'string',
      format: 'utf8',
      maxLength: 256,
    });
  });

  // ─── Composites ──────────────────────────────────────────────────────────

  test('list', () => {
    const type: ClarityType = { list: { type: 'uint128', length: 10 } };
    expect(clarityTypeToSchema(type)).toEqual({
      type: 'array',
      items: 'uint128',
      maxItems: 10,
    });
  });

  test('tuple', () => {
    const type: ClarityType = {
      tuple: [
        { name: 'sender', type: 'principal' },
        { name: 'amount', type: 'uint128' },
      ],
    };
    expect(clarityTypeToSchema(type)).toEqual({
      type: 'object',
      properties: { sender: 'principal', amount: 'uint128' },
      required: ['sender', 'amount'],
    });
  });

  test('optional', () => {
    const type: ClarityType = { optional: 'uint128' };
    expect(clarityTypeToSchema(type)).toEqual({
      anyOf: ['uint128', { type: 'null' }],
    });
  });

  test('response', () => {
    const type: ClarityType = { response: { ok: 'bool', error: 'uint128' } };
    expect(clarityTypeToSchema(type)).toEqual({
      type: 'response',
      ok: 'bool',
      error: 'uint128',
    });
  });

  // ─── Nested composites ──────────────────────────────────────────────────

  test('list of tuples', () => {
    const type: ClarityType = {
      list: {
        type: {
          tuple: [
            { name: 'id', type: 'uint128' },
            { name: 'owner', type: 'principal' },
          ],
        },
        length: 5,
      },
    };
    expect(clarityTypeToSchema(type)).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: { id: 'uint128', owner: 'principal' },
        required: ['id', 'owner'],
      },
      maxItems: 5,
    });
  });

  test('optional response', () => {
    const type: ClarityType = {
      optional: { response: { ok: 'bool', error: 'uint128' } },
    };
    expect(clarityTypeToSchema(type)).toEqual({
      anyOf: [
        { type: 'response', ok: 'bool', error: 'uint128' },
        { type: 'null' },
      ],
    });
  });

  test('response with tuple ok', () => {
    const type: ClarityType = {
      response: {
        ok: {
          tuple: [
            { name: 'balance', type: 'uint128' },
            { name: 'locked', type: 'bool' },
          ],
        },
        error: 'uint128',
      },
    };
    expect(clarityTypeToSchema(type)).toEqual({
      type: 'response',
      ok: {
        type: 'object',
        properties: { balance: 'uint128', locked: 'bool' },
        required: ['balance', 'locked'],
      },
      error: 'uint128',
    });
  });
});
