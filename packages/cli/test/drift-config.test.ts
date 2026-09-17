import { describe, expect, test } from 'bun:test';
import { mergeDefaults, validateConfig } from '../src/config/drift-config';

describe('config validation', () => {
  test('valid config', () => {
    const result = validateConfig({ coverage: { min: 80 } });
    expect(result.ok).toBe(true);
  });

  test('empty object → valid', () => {
    const result = validateConfig({});
    expect(result.ok).toBe(true);
  });

  test('invalid entry type', () => {
    const result = validateConfig({ entry: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('"entry" must be a string');
  });

  test('coverage.min out of range', () => {
    const result = validateConfig({ coverage: { min: 200 } });
    expect(result.ok).toBe(false);
  });

  test('non-object → invalid', () => {
    expect(validateConfig('string').ok).toBe(false);
    expect(validateConfig(null).ok).toBe(false);
    expect(validateConfig([]).ok).toBe(false);
  });

  test('mergeDefaults preserves coverage.min', () => {
    const config = mergeDefaults({ coverage: { min: 50 } });
    expect(config.coverage?.min).toBe(50);
  });

  test('docs.include is valid', () => {
    const result = validateConfig({ docs: { include: ['docs/**'] } });
    expect(result.ok).toBe(true);
  });
});
