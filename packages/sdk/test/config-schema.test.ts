import { describe, expect, test } from 'bun:test';
import { driftConfigSchema, normalizeConfig, parseDriftConfig } from '../src/config/schema';

describe('parseDriftConfig', () => {
  test('accepts an empty object', () => {
    expect(parseDriftConfig({})).toEqual({});
  });

  test('accepts every field, string-or-array lists', () => {
    const input = {
      $schema: 'https://example.com/schema.json',
      entry: 'src/index.ts',
      include: 'foo*',
      exclude: ['bar', 'baz'],
      coverage: { min: 80 },
      docs: { include: ['docs/**/*.md'], exclude: 'docs/internal/**' },
      examples: { run: true },
    };
    expect(parseDriftConfig(input)).toEqual(input);
  });

  test('explicit undefined is treated as absent', () => {
    expect(parseDriftConfig({ entry: undefined, docs: { include: undefined } })).toEqual({
      docs: {},
    });
  });

  test('strips unknown keys at every level', () => {
    expect(
      parseDriftConfig({
        extra: 1,
        coverage: { min: 50, nope: true },
        docs: { include: 'a', nope: true },
        examples: { run: false, nope: true },
      }),
    ).toEqual({ coverage: { min: 50 }, docs: { include: 'a' }, examples: { run: false } });
  });

  test('coverage.min bounds', () => {
    expect(parseDriftConfig({ coverage: { min: 0 } })).toEqual({ coverage: { min: 0 } });
    expect(parseDriftConfig({ coverage: { min: 100 } })).toEqual({ coverage: { min: 100 } });
    expect(() => parseDriftConfig({ coverage: { min: 101 } })).toThrow(
      'drift.config: coverage.min must be a number between 0 and 100',
    );
    expect(() => parseDriftConfig({ coverage: { min: -1 } })).toThrow('coverage.min');
    expect(() => parseDriftConfig({ coverage: { min: Number.NaN } })).toThrow('coverage.min');
    expect(() => parseDriftConfig({ coverage: { min: '80' } })).toThrow('coverage.min');
  });

  test.each([
    [null, 'drift.config: must be an object'],
    [[], 'drift.config: must be an object'],
    ['x', 'drift.config: must be an object'],
    [{ $schema: 1 }, 'drift.config: $schema must be a string'],
    [{ entry: null }, 'drift.config: entry must be a string'],
    [{ include: 1 }, 'drift.config: include must be a string or string[]'],
    [{ exclude: ['a', 2] }, 'drift.config: exclude must be a string or string[]'],
    [{ coverage: 'x' }, 'drift.config: coverage must be an object'],
    [{ coverage: [] }, 'drift.config: coverage must be an object'],
    [{ docs: null }, 'drift.config: docs must be an object'],
    [{ docs: { include: { a: 1 } } }, 'drift.config: docs.include must be a string or string[]'],
    [{ docs: { exclude: [1] } }, 'drift.config: docs.exclude must be a string or string[]'],
    [{ examples: 1 }, 'drift.config: examples must be an object'],
    [{ examples: { run: 'yes' } }, 'drift.config: examples.run must be a boolean'],
  ])('rejects %j', (input, message) => {
    expect(() => parseDriftConfig(input)).toThrow(Error);
    expect(() => parseDriftConfig(input)).toThrow(message);
  });

  test('reports every bad path in one error', () => {
    expect(() => parseDriftConfig({ entry: 1, docs: { include: 2 } })).toThrow(
      'drift.config: entry must be a string; docs.include must be a string or string[]',
    );
  });

  test('driftConfigSchema.parse is the same validator', () => {
    expect(driftConfigSchema.parse({ entry: 'a' })).toEqual({ entry: 'a' });
    expect(() => driftConfigSchema.parse({ entry: 1 })).toThrow('entry must be a string');
  });
});

describe('normalizeConfig', () => {
  test('wraps strings, trims, drops empties', () => {
    expect(
      normalizeConfig({
        entry: 'src/index.ts',
        include: ' foo ',
        exclude: ['', '  ', 'bar '],
        coverage: { min: 80 },
        docs: { include: 'docs/*.md', exclude: [' '] },
        examples: { run: false },
      }),
    ).toEqual({
      entry: 'src/index.ts',
      include: ['foo'],
      exclude: ['bar'],
      coverage: { min: 80 },
      docs: { include: ['docs/*.md'], exclude: undefined },
      examples: { run: false },
    });
  });

  test('drops empty docs and examples blocks', () => {
    expect(normalizeConfig({ docs: { include: [] }, examples: {} })).toEqual({
      entry: undefined,
      include: undefined,
      exclude: undefined,
      coverage: undefined,
      docs: undefined,
      examples: undefined,
    });
  });

  test('composes with parseDriftConfig', () => {
    expect(normalizeConfig(parseDriftConfig({ include: 'a', unknown: 1 })).include).toEqual(['a']);
  });
});
