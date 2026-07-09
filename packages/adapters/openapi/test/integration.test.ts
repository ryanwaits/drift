import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { computeDrift } from '@driftdev/sdk/analysis';
import { fromDocument } from '../src/index';

const fixture = (name: string): string =>
  readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');

// ─── Petstore (vanilla REST) ─────────────────────────────────────────────────

describe('integration: petstore → ApiSpec → computeDrift', () => {
  const spec = fromDocument(fixture('petstore.json'));

  test('maps all operations', () => {
    expect(spec.meta.name).toBe('Petstore');
    expect(spec.meta.version).toBe('1.0.0');
    expect(spec.exports.map((e) => e.name).sort()).toEqual([
      'DELETE /pets/{petId}',
      'createPet',
      'getPet',
      'listPets',
    ]);
  });

  test('path-level parameter reaches operations', () => {
    const getPet = spec.exports.find((e) => e.name === 'getPet');
    const params = getPet?.signatures?.[0].parameters ?? [];
    expect(params.map((p) => p.name)).toEqual(['petId']);
    expect(params[0].required).toBe(true);
  });

  test('requestBody $ref flattens into parameters', () => {
    const createPet = spec.exports.find((e) => e.name === 'createPet');
    const params = createPet?.signatures?.[0].parameters ?? [];
    expect(params.map((p) => p.name)).toEqual(['name', 'tag']);
    expect(params[0].required).toBe(true);
    expect(params[1].required).toBe(false);
  });

  test('deprecated operation flagged', () => {
    const del = spec.exports.find((e) => e.name === 'DELETE /pets/{petId}');
    expect(del?.deprecated).toBe(true);
  });

  test('named schemas become types', () => {
    expect(spec.types?.map((t) => t.name).sort()).toEqual(['Error', 'NewPet', 'Pet']);
  });

  test('feeds computeDrift without error', () => {
    const result = computeDrift(spec);
    expect(result.exports).toBeDefined();
  });
});

// ─── Ashby excerpt (RPC-style: everything POST, oneOf responses) ────────────

describe('integration: ashby excerpt → ApiSpec → computeDrift', () => {
  const spec = fromDocument(fixture('ashby-excerpt.json'));

  test('maps RPC-style POST operations by operationId', () => {
    expect(spec.exports.map((e) => e.name).sort()).toEqual([
      'apiKeyInfo',
      'candidateInfo',
      'candidateList',
    ]);
    for (const exp of spec.exports) {
      expect((exp.flags as Record<string, unknown>).method).toBe('POST');
    }
  });

  test('descriptions carried for docs-claims checking', () => {
    const info = spec.exports.find((e) => e.name === 'candidateInfo');
    expect(info?.description).toContain('Fetches details about a single candidate');
    expect(info?.tags).toContainEqual({ name: 'summary', text: 'candidate.info' });
  });

  test('requestBody flattened with param descriptions', () => {
    const info = spec.exports.find((e) => e.name === 'candidateInfo');
    const params = info?.signatures?.[0].parameters ?? [];
    const names = params.map((p) => p.name);
    expect(names).toContain('id');
    expect(names).toContain('externalMappingId');
    expect(params.find((p) => p.name === 'id')?.description).toContain('id of the candidate');
  });

  test('oneOf [success, error] response resolved inline', () => {
    const info = spec.exports.find((e) => e.name === 'candidateInfo');
    const schema = info?.signatures?.[0].returns?.schema as Record<string, unknown>;
    const oneOf = schema.oneOf as Record<string, unknown>[];
    expect(oneOf).toHaveLength(2);
    // Both arms resolved from $ref into inline object schemas
    for (const arm of oneOf) {
      expect(arm.$ref).toBeUndefined();
      expect(arm.type).toBe('object');
    }
  });

  test('component schemas exposed as types', () => {
    const names = spec.types?.map((t) => t.name) ?? [];
    expect(names).toContain('Candidate');
    expect(names).toContain('ErrorResponse');
  });

  test('feeds computeDrift without error', () => {
    const result = computeDrift(spec);
    expect(result.exports).toBeDefined();
  });
});

// ─── fromDocument input handling ─────────────────────────────────────────────

describe('fromDocument', () => {
  test('accepts parsed object', () => {
    const spec = fromDocument({ openapi: '3.0.0', info: { title: 'x' }, paths: {} });
    expect(spec.meta.name).toBe('x');
  });

  test('rejects non-JSON input', () => {
    expect(() => fromDocument('openapi: 3.1.0')).toThrow('YAML is not supported');
  });
});
