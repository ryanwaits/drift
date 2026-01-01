/**
 * Tests for spec diffing and breaking change detection.
 */
import { describe, expect, test } from 'bun:test';
import {
  calculateNextVersion,
  categorizeBreakingChanges,
  diffSpec,
  recommendSemverBump,
} from '@openpkg-ts/spec';
import { createEnrichedSpec, createExport, createSpec } from './test-helpers';

describe('diffSpec', () => {
  describe('structural changes', () => {
    test('detects removed exports as breaking', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo' }), createExport({ name: 'bar' })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo' })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.breaking).toContain('bar');
      expect(diff.breaking).toHaveLength(1);
    });

    test('detects new exports as non-breaking', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo' })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo' }), createExport({ name: 'bar' })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.nonBreaking).toContain('bar');
      expect(diff.breaking).toHaveLength(0);
    });

    test('detects signature changes as breaking', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', signature: 'function foo(): void' })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', signature: 'function foo(x: number): void' })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.breaking).toContain('foo');
    });

    test('empty specs produce no changes', () => {
      const oldSpec = createEnrichedSpec({ exports: [] });
      const newSpec = createEnrichedSpec({ exports: [] });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.breaking).toHaveLength(0);
      expect(diff.nonBreaking).toHaveLength(0);
      expect(diff.docsOnly).toHaveLength(0);
    });

    test('identical specs produce no changes', () => {
      const exp = createExport({ name: 'foo', signature: 'function foo(): void' });
      const oldSpec = createEnrichedSpec({ exports: [exp] });
      const newSpec = createEnrichedSpec({ exports: [{ ...exp }] });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.breaking).toHaveLength(0);
      expect(diff.nonBreaking).toHaveLength(0);
      expect(diff.docsOnly).toHaveLength(0);
    });
  });

  describe('docs-only changes', () => {
    test('description changes are docs-only', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', description: 'Old description' })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', description: 'New description' })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.docsOnly).toContain('foo');
      expect(diff.breaking).toHaveLength(0);
    });

    test('example changes are docs-only', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', examples: ['old example'] })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', examples: ['new example'] })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.docsOnly).toContain('foo');
      expect(diff.breaking).toHaveLength(0);
    });

    test('source location changes are docs-only', () => {
      const oldSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', source: { file: 'old.ts', line: 1 } })],
      });
      const newSpec = createEnrichedSpec({
        exports: [createExport({ name: 'foo', source: { file: 'new.ts', line: 10 } })],
      });

      const diff = diffSpec(oldSpec, newSpec);

      expect(diff.docsOnly).toContain('foo');
      expect(diff.breaking).toHaveLength(0);
    });
  });

});

describe('categorizeBreakingChanges', () => {
  test('categorizes removed function as high severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'foo', kind: 'function' })],
    });
    const newSpec = createEnrichedSpec({ exports: [] });

    const categorized = categorizeBreakingChanges(['foo'], oldSpec, newSpec);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('removed');
  });

  test('categorizes removed class as high severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'MyClass', kind: 'class' })],
    });
    const newSpec = createEnrichedSpec({ exports: [] });

    const categorized = categorizeBreakingChanges(['MyClass'], oldSpec, newSpec);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('high');
  });

  test('categorizes removed interface as medium severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'Options', kind: 'interface' })],
    });
    const newSpec = createEnrichedSpec({ exports: [] });

    const categorized = categorizeBreakingChanges(['Options'], oldSpec, newSpec);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('medium');
  });

  test('categorizes function signature change as high severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'foo', kind: 'function', signature: 'function foo(): void' })],
    });
    const newSpec = createEnrichedSpec({
      exports: [
        createExport({ name: 'foo', kind: 'function', signature: 'function foo(x: number): void' }),
      ],
    });

    const categorized = categorizeBreakingChanges(['foo'], oldSpec, newSpec);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('signature changed');
  });

  test('categorizes type definition change as medium severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'Config', kind: 'type' })],
    });
    const newSpec = createEnrichedSpec({
      exports: [
        createExport({ name: 'Config', kind: 'type', signature: 'type Config = { new: true }' }),
      ],
    });

    const categorized = categorizeBreakingChanges(['Config'], oldSpec, newSpec);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('medium');
    expect(categorized[0].reason).toBe('type definition changed');
  });

  test('sorts results by severity (high first)', () => {
    const oldSpec = createEnrichedSpec({
      exports: [
        createExport({ name: 'fn', kind: 'function' }),
        createExport({ name: 'Type', kind: 'type' }),
        createExport({ name: 'VAR', kind: 'variable' }),
      ],
    });
    const newSpec = createEnrichedSpec({ exports: [] });

    const categorized = categorizeBreakingChanges(['Type', 'VAR', 'fn'], oldSpec, newSpec);

    expect(categorized[0].name).toBe('fn'); // high
    expect(categorized[1].name).toBe('Type'); // medium
    expect(categorized[2].name).toBe('VAR'); // medium (or low)
  });

  test('handles class with constructor changes as high severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'MyClass', kind: 'class' })],
    });
    const newSpec = createEnrichedSpec({
      exports: [createExport({ name: 'MyClass', kind: 'class' })],
    });

    const memberChanges = [
      {
        className: 'MyClass',
        memberName: 'constructor',
        memberKind: 'constructor' as const,
        changeType: 'signature-changed' as const,
      },
    ];

    const categorized = categorizeBreakingChanges(['MyClass'], oldSpec, newSpec, memberChanges);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('constructor changed');
  });

  test('handles class with removed method as high severity', () => {
    const oldSpec = createEnrichedSpec({
      exports: [createExport({ name: 'MyClass', kind: 'class' })],
    });
    const newSpec = createEnrichedSpec({
      exports: [createExport({ name: 'MyClass', kind: 'class' })],
    });

    const memberChanges = [
      {
        className: 'MyClass',
        memberName: 'doSomething',
        memberKind: 'method' as const,
        changeType: 'removed' as const,
      },
    ];

    const categorized = categorizeBreakingChanges(['MyClass'], oldSpec, newSpec, memberChanges);

    expect(categorized).toHaveLength(1);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('methods removed');
  });
});

describe('recommendSemverBump', () => {
  test('recommends major for breaking changes', () => {
    const diff = {
      breaking: ['foo', 'bar'],
      nonBreaking: [],
      docsOnly: [],
      coverageDelta: 0,
      oldCoverage: 100,
      newCoverage: 100,
      newUndocumented: [],
      improvedExports: [],
      regressedExports: [],
      driftIntroduced: 0,
      driftResolved: 0,
    };

    const result = recommendSemverBump(diff);

    expect(result.bump).toBe('major');
    expect(result.breakingCount).toBe(2);
  });

  test('recommends minor for new exports', () => {
    const diff = {
      breaking: [],
      nonBreaking: ['newFn', 'anotherFn'],
      docsOnly: [],
      coverageDelta: 0,
      oldCoverage: 100,
      newCoverage: 100,
      newUndocumented: [],
      improvedExports: [],
      regressedExports: [],
      driftIntroduced: 0,
      driftResolved: 0,
    };

    const result = recommendSemverBump(diff);

    expect(result.bump).toBe('minor');
    expect(result.additionCount).toBe(2);
  });

  test('recommends patch for docs-only changes', () => {
    const diff = {
      breaking: [],
      nonBreaking: [],
      docsOnly: ['foo'],
      coverageDelta: 0,
      oldCoverage: 100,
      newCoverage: 100,
      newUndocumented: [],
      improvedExports: [],
      regressedExports: [],
      driftIntroduced: 0,
      driftResolved: 0,
    };

    const result = recommendSemverBump(diff);

    expect(result.bump).toBe('patch');
    expect(result.docsOnlyChanges).toBe(true);
  });

  test('recommends none for no changes', () => {
    const diff = {
      breaking: [],
      nonBreaking: [],
      docsOnly: [],
      coverageDelta: 0,
      oldCoverage: 100,
      newCoverage: 100,
      newUndocumented: [],
      improvedExports: [],
      regressedExports: [],
      driftIntroduced: 0,
      driftResolved: 0,
    };

    const result = recommendSemverBump(diff);

    expect(result.bump).toBe('none');
  });

  test('prioritizes breaking over additions', () => {
    const diff = {
      breaking: ['old'],
      nonBreaking: ['new'],
      docsOnly: ['docs'],
      coverageDelta: 0,
      oldCoverage: 100,
      newCoverage: 100,
      newUndocumented: [],
      improvedExports: [],
      regressedExports: [],
      driftIntroduced: 0,
      driftResolved: 0,
    };

    const result = recommendSemverBump(diff);

    expect(result.bump).toBe('major');
  });
});

describe('calculateNextVersion', () => {
  test('bumps major version', () => {
    expect(calculateNextVersion('1.2.3', 'major')).toBe('2.0.0');
    expect(calculateNextVersion('0.9.5', 'major')).toBe('1.0.0');
  });

  test('bumps minor version', () => {
    expect(calculateNextVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(calculateNextVersion('2.0.0', 'minor')).toBe('2.1.0');
  });

  test('bumps patch version', () => {
    expect(calculateNextVersion('1.2.3', 'patch')).toBe('1.2.4');
    expect(calculateNextVersion('1.0.0', 'patch')).toBe('1.0.1');
  });

  test('returns same version for none', () => {
    expect(calculateNextVersion('1.2.3', 'none')).toBe('1.2.3');
  });

  test('handles v prefix', () => {
    expect(calculateNextVersion('v1.2.3', 'major')).toBe('v2.0.0');
    expect(calculateNextVersion('v1.2.3', 'minor')).toBe('v1.3.0');
  });

  test('handles unparseable version', () => {
    expect(calculateNextVersion('not-a-version', 'major')).toBe('not-a-version');
  });
});
