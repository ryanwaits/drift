/**
 * Tests for isExportDocumented().
 */
import { describe, expect, test } from 'bun:test';
import type { ApiExport } from '../src/analysis/api-spec';
import { isExportDocumented } from '../src/analysis/documented';

describe('isExportDocumented', () => {
  function createExport(overrides: Partial<ApiExport>): ApiExport {
    return {
      id: 'test',
      name: 'test',
      kind: 'function',
      ...overrides,
    };
  }

  describe('description-based documentation', () => {
    test('export with description is documented', () => {
      const exp = createExport({ description: 'This is a documented export' });
      expect(isExportDocumented(exp)).toBe(true);
    });

    test('export with empty description is not documented', () => {
      const exp = createExport({ description: '' });
      expect(isExportDocumented(exp)).toBe(false);
    });

    test('export with whitespace-only description is not documented', () => {
      const exp = createExport({ description: '   ' });
      expect(isExportDocumented(exp)).toBe(false);
    });

    test('export with undefined description is not documented', () => {
      const exp = createExport({ description: undefined });
      expect(isExportDocumented(exp)).toBe(false);
    });
  });

  describe('tag-based documentation', () => {
    test('export with meaningful tags is documented', () => {
      const exp = createExport({
        description: undefined,
        tags: [{ name: 'deprecated', text: 'Use newFunction instead' }],
      });
      expect(isExportDocumented(exp)).toBe(true);
    });

    test('export with @internal tag only is not documented', () => {
      const exp = createExport({
        description: undefined,
        tags: [{ name: 'internal', text: '' }],
      });
      expect(isExportDocumented(exp)).toBe(false);
    });

    test('export with multiple tags including @internal is documented', () => {
      const exp = createExport({
        description: undefined,
        tags: [
          { name: 'internal', text: '' },
          { name: 'experimental', text: '' },
        ],
      });
      expect(isExportDocumented(exp)).toBe(true);
    });

    test('export with empty tags array is not documented', () => {
      const exp = createExport({ description: undefined, tags: [] });
      expect(isExportDocumented(exp)).toBe(false);
    });
  });

  describe('namespace documentation', () => {
    test('namespace with description is documented', () => {
      const exp = createExport({
        kind: 'namespace',
        description: 'Effect module with re-exported functions',
      });
      expect(isExportDocumented(exp)).toBe(true);
    });

    test('namespace without description is not documented', () => {
      const exp = createExport({ kind: 'namespace', description: undefined });
      expect(isExportDocumented(exp)).toBe(false);
    });

    test('namespace with tags but no description is documented', () => {
      const exp = createExport({
        kind: 'namespace',
        description: undefined,
        tags: [{ name: 'module', text: 'effect' }],
      });
      expect(isExportDocumented(exp)).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('export with no documentation fields is not documented', () => {
      const exp = createExport({
        description: undefined,
        tags: undefined,
      });
      expect(isExportDocumented(exp)).toBe(false);
    });

    test('export with both description and tags is documented', () => {
      const exp = createExport({
        description: 'Well documented',
        tags: [{ name: 'example', text: 'foo()' }],
      });
      expect(isExportDocumented(exp)).toBe(true);
    });
  });
});
