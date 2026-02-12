/**
 * Tests for buildDocCovSpec() function with progress callback.
 */
import { describe, expect, test } from 'bun:test';
import { buildDocCovSpec } from '../src/analysis/doccov-builder';
import type { OpenPkgSpec } from '../src/analysis/spec-types';

/**
 * Create a minimal OpenPkg spec with N exports for testing.
 */
function createSpecWithExports(count: number): OpenPkgSpec {
  const exports = [];
  for (let i = 0; i < count; i++) {
    exports.push({
      name: `export${i}`,
      kind: 'function' as const,
      description: `Export ${i} description`,
      signatures: [
        {
          parameters: [{ name: 'arg', schema: { type: 'string' } }],
          returns: { schema: { type: 'void' } },
        },
      ],
    });
  }

  return {
    openpkg: '1.0.0',
    meta: {
      name: 'test-package',
      version: '1.0.0',
    },
    exports,
  };
}

describe('buildDocCovSpec', () => {
  describe('onProgress callback', () => {
    test('invoked for each export', async () => {
      const spec = createSpecWithExports(10);
      const progressCalls: Array<{ current: number; total: number; item: string }> = [];

      await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
        onProgress: (current, total, item) => {
          progressCalls.push({ current, total, item });
        },
      });

      expect(progressCalls.length).toBe(10);
      expect(progressCalls[0]).toEqual({ current: 1, total: 10, item: 'export0' });
      expect(progressCalls[9]).toEqual({ current: 10, total: 10, item: 'export9' });
    });

    test('no callback errors when onProgress not provided', async () => {
      const spec = createSpecWithExports(5);

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      expect(result.summary.totalExports).toBe(5);
    });

    test('yields to event loop during processing', async () => {
      const spec = createSpecWithExports(20); // > YIELD_BATCH_SIZE (5)
      let yieldOccurred = false;

      // Schedule a micro-task that should run during async yields
      const yieldCheck = setImmediate(() => {
        yieldOccurred = true;
      });

      await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      clearImmediate(yieldCheck);

      // If setImmediate callback ran, the event loop was yielded to
      expect(yieldOccurred).toBe(true);
    });
  });

  describe('coverage analysis', () => {
    test('computes correct export count', async () => {
      const spec = createSpecWithExports(15);

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      expect(result.summary.totalExports).toBe(15);
    });

    test('returns valid DocCovSpec structure', async () => {
      const spec = createSpecWithExports(3);

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      expect(result.doccov).toBe('1.0.0');
      expect(result.source.file).toBe('test.json');
      expect(result.source.packageName).toBe('test-package');
      expect(result.summary).toBeDefined();
      expect(result.exports).toBeDefined();
    });
  });

  describe('@internal exclusion', () => {
    test('excludes @internal exports from analysis', async () => {
      const spec: OpenPkgSpec = {
        openpkg: '1.0.0',
        meta: { name: 'test-package' },
        exports: [
          { name: 'publicFn', kind: 'function', description: 'Public function' },
          {
            name: 'internalFn',
            kind: 'function',
            description: 'Internal function',
            tags: [{ name: 'internal', text: '' }],
          },
          { name: 'anotherPublic', kind: 'function', description: 'Another public' },
        ],
      };

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      // Should only count non-internal exports
      expect(result.summary.totalExports).toBe(2);
      expect(Object.keys(result.exports)).toEqual(['publicFn', 'anotherPublic']);
      expect(result.exports['internalFn']).toBeUndefined();
    });

    test('handles all @internal exports gracefully', async () => {
      const spec: OpenPkgSpec = {
        openpkg: '1.0.0',
        meta: { name: 'test-package' },
        exports: [
          { name: 'internal1', kind: 'function', tags: [{ name: 'internal', text: '' }] },
          { name: 'internal2', kind: 'function', tags: [{ name: 'internal', text: '' }] },
        ],
      };

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      expect(result.summary.totalExports).toBe(0);
      expect(result.summary.score).toBe(100); // No exports = 100% coverage
    });
  });

  describe('integration: large export count', () => {
    test('handles 100+ exports with progress updates', async () => {
      const exportCount = 150;
      const spec = createSpecWithExports(exportCount);
      const progressCalls: number[] = [];

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'large-package.json',
        onProgress: (current, _total, _item) => {
          progressCalls.push(current);
        },
      });

      // Verify all exports processed
      expect(result.summary.totalExports).toBe(exportCount);
      expect(progressCalls.length).toBe(exportCount);

      // Verify progress is sequential
      for (let i = 0; i < exportCount; i++) {
        expect(progressCalls[i]).toBe(i + 1);
      }

      // Verify coverage data computed for all exports
      expect(Object.keys(result.exports).length).toBe(exportCount);
    });

    test('async function allows concurrent operations', async () => {
      const spec = createSpecWithExports(100);
      let concurrentTaskRan = false;

      // Start a concurrent promise
      const concurrentPromise = (async () => {
        // This should be able to run during buildDocCovSpec's yields
        await new Promise((r) => setImmediate(r));
        concurrentTaskRan = true;
      })();

      // Run buildDocCovSpec
      await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      // Wait for concurrent promise to complete
      await concurrentPromise;

      // The concurrent task should have had a chance to run
      expect(concurrentTaskRan).toBe(true);
    });
  });

  describe('overload grouping', () => {
    test('groups overloaded functions by name', async () => {
      const spec: OpenPkgSpec = {
        openpkg: '1.0.0',
        meta: { name: 'test-package', version: '1.0.0' },
        exports: [
          {
            id: 'pipe-1',
            name: 'pipe',
            kind: 'function',
            description: '', // undocumented
            signatures: [{ parameters: [{ name: 'a', schema: { type: 'number' } }] }],
          },
          {
            id: 'pipe-2',
            name: 'pipe',
            kind: 'function',
            description: 'Pipes values through functions', // documented
            signatures: [{ parameters: [{ name: 'a', schema: { type: 'string' } }] }],
          },
          {
            id: 'pipe-3',
            name: 'pipe',
            kind: 'function',
            description: '', // undocumented
            signatures: [{ parameters: [{ name: 'a', schema: { type: 'boolean' } }] }],
          },
          {
            id: 'other-fn',
            name: 'otherFn',
            kind: 'function',
            description: 'Other function',
          },
        ],
      };

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      // Should count 2 unique exports: pipe + otherFn
      expect(result.summary.totalExports).toBe(2);

      // pipe should be grouped and use best coverage
      expect(result.exports['pipe-2']).toBeDefined();
      expect(result.exports['pipe-2'].overloadCount).toBe(3);
      // The documented one (pipe-2) has best score
      expect(result.exports['pipe-2'].coverageScore).toBeGreaterThan(0);

      // otherFn should have no overloadCount
      expect(result.exports['other-fn']).toBeDefined();
      expect(result.exports['other-fn'].overloadCount).toBeUndefined();
    });

    test('uses best coverage score from overloads', async () => {
      const spec: OpenPkgSpec = {
        openpkg: '1.0.0',
        meta: { name: 'test-package', version: '1.0.0' },
        exports: [
          {
            id: 'fn-1',
            name: 'myFunction',
            kind: 'function',
            description: '', // score ~0
          },
          {
            id: 'fn-2',
            name: 'myFunction',
            kind: 'function',
            description: 'Well documented',
            examples: ['console.log("example")'], // higher score
          },
        ],
      };

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      // Should use the documented version's score
      expect(result.exports['fn-2']).toBeDefined();
      expect(result.exports['fn-2'].coverageScore).toBeGreaterThan(50);
    });

    test('counts documented correctly with overloads', async () => {
      const spec: OpenPkgSpec = {
        openpkg: '1.0.0',
        meta: { name: 'test-package', version: '1.0.0' },
        exports: [
          // 3 overloads of pipe, one fully documented
          {
            name: 'pipe',
            kind: 'function',
            description: 'Full docs',
            examples: ['pipe(1,2,3)'],
          },
          { name: 'pipe', kind: 'function', description: '' },
          { name: 'pipe', kind: 'function', description: '' },
          // Distinct function, undocumented
          { name: 'other', kind: 'function', description: '' },
        ],
      };

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      // 2 unique exports: pipe (counted once) + other
      expect(result.summary.totalExports).toBe(2);
      // pipe has 100% coverage from its documented overload
      expect(result.summary.documentedExports).toBe(1);
    });
  });

  describe('namespace documentation counting', () => {
    test('namespace with description counts as documented', async () => {
      const spec: OpenPkgSpec = {
        openpkg: '1.0.0',
        meta: { name: 'test-package', version: '1.0.0' },
        exports: [
          {
            name: 'Effect',
            kind: 'namespace',
            description: 'Effect module with re-exported functions',
          },
          {
            name: 'undocumentedFn',
            kind: 'function',
            description: '',
          },
          {
            name: 'documentedFn',
            kind: 'function',
            description: 'A documented function',
            examples: ['documentedFn()'],
          },
        ],
      };

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      // 2 out of 3 should be documented (Effect namespace + documentedFn)
      expect(result.summary.documentedExports).toBe(2);
      expect(result.summary.totalExports).toBe(3);
    });

    test('namespace without description does not count as documented', async () => {
      const spec: OpenPkgSpec = {
        openpkg: '1.0.0',
        meta: { name: 'test-package', version: '1.0.0' },
        exports: [
          {
            name: 'Utils',
            kind: 'namespace',
            description: '', // Empty description
          },
          {
            name: 'documented',
            kind: 'function',
            description: 'Has docs',
          },
        ],
      };

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      // Only 1 documented (the function)
      expect(result.summary.documentedExports).toBe(1);
      expect(result.summary.totalExports).toBe(2);
    });

    test('export with tags but no description counts as documented', async () => {
      const spec: OpenPkgSpec = {
        openpkg: '1.0.0',
        meta: { name: 'test-package', version: '1.0.0' },
        exports: [
          {
            name: 'deprecatedFn',
            kind: 'function',
            description: '',
            tags: [{ name: 'deprecated', text: 'Use newFn instead' }],
          },
        ],
      };

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
      });

      expect(result.summary.documentedExports).toBe(1);
    });
  });

  describe('entryExportNames filtering', () => {
    test('filters forgotten exports that exist in entry exports', async () => {
      const spec: OpenPkgSpec = {
        openpkg: '1.0.0',
        meta: { name: 'test-package', version: '1.0.0' },
        exports: [{ name: 'myFunc', kind: 'function', description: 'A function' }],
        types: [{ name: 'MyType', schema: { type: 'object' } }],
      };

      const forgottenExports = [
        { name: 'ForgottenType', referencedBy: [], isExternal: false },
        { name: 'TypeInEntry', referencedBy: [], isExternal: false },
        { name: 'AnotherForgotten', referencedBy: [], isExternal: false },
      ];

      // Without entryExportNames - all forgotten exports reported
      const resultWithout = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
        forgottenExports,
      });

      expect(resultWithout.apiSurface?.forgotten.length).toBe(3);

      // With entryExportNames - TypeInEntry should be filtered out
      const resultWith = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
        forgottenExports,
        entryExportNames: ['TypeInEntry', 'OtherExport'],
      });

      expect(resultWith.apiSurface?.forgotten.length).toBe(2);
      expect(resultWith.apiSurface?.forgotten.map((f) => f.name)).toEqual([
        'ForgottenType',
        'AnotherForgotten',
      ]);
    });

    test('combines entryExportNames with apiSurfaceIgnore', async () => {
      const spec: OpenPkgSpec = {
        openpkg: '1.0.0',
        meta: { name: 'test-package', version: '1.0.0' },
        exports: [{ name: 'myFunc', kind: 'function', description: 'A function' }],
        types: [{ name: 'MyType', schema: { type: 'object' } }],
      };

      const forgottenExports = [
        { name: 'Ignored', referencedBy: [], isExternal: false },
        { name: 'InEntry', referencedBy: [], isExternal: false },
        { name: 'ActuallyForgotten', referencedBy: [], isExternal: false },
      ];

      const result = await buildDocCovSpec({
        openpkg: spec,
        openpkgPath: 'test.json',
        forgottenExports,
        apiSurfaceIgnore: ['Ignored'],
        entryExportNames: ['InEntry'],
      });

      expect(result.apiSurface?.forgotten.length).toBe(1);
      expect(result.apiSurface?.forgotten[0].name).toBe('ActuallyForgotten');
    });
  });
});
