/**
 * Tests for documentation style presets.
 */
import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_REQUIREMENTS,
  PRESETS,
  resolveRequirements,
  type DocRequirements,
  type StylePreset,
} from '../src/analysis/presets';

describe('PRESETS', () => {
  test('minimal preset requires only description', () => {
    const preset = PRESETS.minimal;
    expect(preset.description).toBe(true);
    expect(preset.params).toBe(false);
    expect(preset.returns).toBe(false);
    expect(preset.examples).toBe(false);
    expect(preset.since).toBe(false);
  });

  test('verbose preset requires description, params, and returns', () => {
    const preset = PRESETS.verbose;
    expect(preset.description).toBe(true);
    expect(preset.params).toBe(true);
    expect(preset.returns).toBe(true);
    expect(preset.examples).toBe(false);
    expect(preset.since).toBe(false);
  });

  test('types-only preset requires nothing', () => {
    const preset = PRESETS['types-only'];
    expect(preset.description).toBe(false);
    expect(preset.params).toBe(false);
    expect(preset.returns).toBe(false);
    expect(preset.examples).toBe(false);
    expect(preset.since).toBe(false);
  });
});

describe('DEFAULT_REQUIREMENTS', () => {
  test('default matches minimal preset', () => {
    expect(DEFAULT_REQUIREMENTS).toEqual(PRESETS.minimal);
  });
});

describe('resolveRequirements', () => {
  test('returns default requirements when no args', () => {
    const result = resolveRequirements();
    expect(result).toEqual(DEFAULT_REQUIREMENTS);
  });

  test('returns preset requirements when style specified', () => {
    expect(resolveRequirements('minimal')).toEqual(PRESETS.minimal);
    expect(resolveRequirements('verbose')).toEqual(PRESETS.verbose);
    expect(resolveRequirements('types-only')).toEqual(PRESETS['types-only']);
  });

  test('overrides preset with custom requirements', () => {
    const result = resolveRequirements('minimal', { examples: true });

    expect(result.description).toBe(true); // from minimal
    expect(result.params).toBe(false); // from minimal
    expect(result.returns).toBe(false); // from minimal
    expect(result.examples).toBe(true); // overridden
    expect(result.since).toBe(false); // from minimal
  });

  test('overrides default with custom requirements', () => {
    const result = resolveRequirements(undefined, { params: true, returns: true });

    expect(result.description).toBe(true); // from default
    expect(result.params).toBe(true); // overridden
    expect(result.returns).toBe(true); // overridden
    expect(result.examples).toBe(false); // from default
  });

  test('partial overrides only affect specified keys', () => {
    const result = resolveRequirements('verbose', { examples: true });

    // Everything from verbose except examples
    expect(result.description).toBe(true);
    expect(result.params).toBe(true);
    expect(result.returns).toBe(true);
    expect(result.examples).toBe(true); // overridden (verbose has false)
    expect(result.since).toBe(false);
  });

  test('can disable requirements from verbose preset', () => {
    const result = resolveRequirements('verbose', { params: false, returns: false });

    expect(result.description).toBe(true);
    expect(result.params).toBe(false); // disabled
    expect(result.returns).toBe(false); // disabled
    expect(result.examples).toBe(false);
  });

  test('returns new object to avoid mutation', () => {
    const result1 = resolveRequirements('minimal');
    const result2 = resolveRequirements('minimal');

    expect(result1).not.toBe(result2);
    expect(result1).toEqual(result2);
  });
});
