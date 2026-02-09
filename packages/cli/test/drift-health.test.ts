import { describe, expect, test } from 'bun:test';
import { computeHealth } from '../src/utils/health';

describe('health score computation', () => {
  test('100% completeness + 100% accuracy = 100% health', () => {
    const result = computeHealth(10, 10, []);
    expect(result.health).toBe(100);
    expect(result.completeness).toBe(100);
    expect(result.accuracy).toBe(100);
  });

  test('50% completeness + 100% accuracy = 75% health', () => {
    const result = computeHealth(10, 5, []);
    expect(result.health).toBe(75);
    expect(result.completeness).toBe(50);
    expect(result.accuracy).toBe(100);
  });

  test('100% completeness + 50% accuracy = 75% health', () => {
    const issues = Array.from({ length: 5 }, (_, i) => ({ export: `exp${i}`, issue: 'test' }));
    const result = computeHealth(10, 10, issues);
    expect(result.health).toBe(75);
    expect(result.completeness).toBe(100);
    expect(result.accuracy).toBe(50);
  });

  test('0 exports = 100% health', () => {
    const result = computeHealth(0, 0, []);
    expect(result.health).toBe(100);
  });

  test('multiple issues per export counted as one drifted export', () => {
    const issues = [
      { export: 'foo', issue: 'issue 1' },
      { export: 'foo', issue: 'issue 2' },
      { export: 'bar', issue: 'issue 3' },
    ];
    const result = computeHealth(10, 10, issues);
    expect(result.drifted).toBe(2);
    expect(result.accuracy).toBe(80);
  });
});
