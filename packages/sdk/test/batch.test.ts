import { describe, expect, test } from 'bun:test';
import type { ApiSpec } from '../src/analysis/api-spec';
import { aggregateResults, createPackageResult, type PackageResult } from '../src/analysis/batch';
import type { DriftSpec } from '../src/spec';

function createMockApiSpec(name: string, version: string): ApiSpec {
  return {
    meta: { name, version },
    exports: [],
  };
}

function createMockDriftSpec(
  totalExports: number,
  coverageScore: number,
  driftTotal: number,
): DriftSpec {
  return {
    summary: {
      totalExports,
      documentedExports: Math.round((totalExports * coverageScore) / 100),
      score: coverageScore,
      missingByRule: {
        description: 0,
        params: 0,
        returns: 0,
        examples: 0,
        throws: 0,
      },
      drift: {
        total: driftTotal,
        byCategory: { structural: 0, semantic: 0, example: 0, prose: 0 },
      },
    },
    exports: {},
  } as DriftSpec;
}

describe('batch analysis', () => {
  describe('createPackageResult', () => {
    test('creates result from specs', () => {
      const openpkg = createMockApiSpec('@test/pkg-a', '1.0.0');
      const driftSpec = createMockDriftSpec(10, 80, 2);

      const result = createPackageResult(openpkg, driftSpec, 'packages/a/src/index.ts');

      expect(result.name).toBe('@test/pkg-a');
      expect(result.version).toBe('1.0.0');
      expect(result.entryPath).toBe('packages/a/src/index.ts');
      expect(result.totalExports).toBe(10);
      expect(result.coverageScore).toBe(80);
      expect(result.documented).toBe(8);
      expect(result.driftCount).toBe(2);
    });
  });

  describe('aggregateResults', () => {
    test('aggregates empty results', () => {
      const batch = aggregateResults([]);

      expect(batch.packages).toHaveLength(0);
      expect(batch.aggregate.totalExports).toBe(0);
      expect(batch.aggregate.coverageScore).toBe(0);
    });

    test('aggregates single package', () => {
      const result: PackageResult = {
        name: '@test/single',
        version: '1.0.0',
        entryPath: 'src/index.ts',
        totalExports: 20,
        documented: 15,
        driftCount: 3,
        coverageScore: 75,
        openpkg: createMockApiSpec('@test/single', '1.0.0'),
        driftSpec: createMockDriftSpec(20, 75, 3),
      };

      const batch = aggregateResults([result]);

      expect(batch.packages).toHaveLength(1);
      expect(batch.aggregate.totalExports).toBe(20);
      expect(batch.aggregate.documented).toBe(15);
      expect(batch.aggregate.coverageScore).toBe(75);
      expect(batch.aggregate.driftCount).toBe(3);
    });

    test('aggregates multiple packages with weighted average', () => {
      const results: PackageResult[] = [
        {
          name: '@test/pkg-a',
          version: '1.0.0',
          entryPath: 'packages/a/src/index.ts',
          totalExports: 100,
          documented: 90,
          driftCount: 2,
          coverageScore: 90,
          openpkg: createMockApiSpec('@test/pkg-a', '1.0.0'),
          driftSpec: createMockDriftSpec(100, 90, 2),
        },
        {
          name: '@test/pkg-b',
          version: '1.0.0',
          entryPath: 'packages/b/src/index.ts',
          totalExports: 50,
          documented: 30,
          driftCount: 5,
          coverageScore: 60,
          openpkg: createMockApiSpec('@test/pkg-b', '1.0.0'),
          driftSpec: createMockDriftSpec(50, 60, 5),
        },
      ];

      const batch = aggregateResults(results);

      expect(batch.packages).toHaveLength(2);
      expect(batch.aggregate.totalExports).toBe(150);
      expect(batch.aggregate.documented).toBe(120);
      expect(batch.aggregate.coverageScore).toBe(80);
      expect(batch.aggregate.driftCount).toBe(7);
    });

    test('handles packages with zero exports', () => {
      const results: PackageResult[] = [
        {
          name: '@test/empty',
          version: '1.0.0',
          entryPath: 'packages/empty/src/index.ts',
          totalExports: 0,
          documented: 0,
          driftCount: 0,
          coverageScore: 0,
          openpkg: createMockApiSpec('@test/empty', '1.0.0'),
          driftSpec: createMockDriftSpec(0, 0, 0),
        },
        {
          name: '@test/real',
          version: '1.0.0',
          entryPath: 'packages/real/src/index.ts',
          totalExports: 10,
          documented: 8,
          driftCount: 1,
          coverageScore: 80,
          openpkg: createMockApiSpec('@test/real', '1.0.0'),
          driftSpec: createMockDriftSpec(10, 80, 1),
        },
      ];

      const batch = aggregateResults(results);

      expect(batch.aggregate.totalExports).toBe(10);
      expect(batch.aggregate.coverageScore).toBe(80);
    });
  });
});
