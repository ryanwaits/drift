import { describe, expect, test } from 'bun:test';
import type { DriftSpec } from '@driftdev/spec';
import type { OpenPkg } from '@openpkg-ts/spec';
import { aggregateResults, createPackageResult, type PackageResult } from '../src/analysis/batch';

// Minimal mock OpenPkg spec
function createMockOpenPkg(name: string, version: string): OpenPkg {
  return {
    meta: { name, version },
    exports: [],
  };
}

// Minimal mock Drift spec
function createMockDriftSpec(totalExports: number, health: number, driftTotal: number): DriftSpec {
  return {
    summary: {
      totalExports,
      score: health,
      drift: {
        total: driftTotal,
        fixable: 0,
        byCategory: { structural: 0, semantic: 0, example: 0 },
      },
      health: {
        score: health,
        completeness: {
          score: health,
          total: totalExports,
          documented: Math.round((totalExports * health) / 100),
          missing: {},
        },
        accuracy: {
          score: 100,
          issues: driftTotal,
          fixable: 0,
          byCategory: { structural: 0, semantic: 0, example: 0 },
        },
      },
    },
    exports: {},
  };
}

describe('batch analysis', () => {
  describe('createPackageResult', () => {
    test('creates result from specs', () => {
      const openpkg = createMockOpenPkg('@test/pkg-a', '1.0.0');
      const driftSpec = createMockDriftSpec(10, 80, 2);

      const result = createPackageResult(openpkg, driftSpec, 'packages/a/src/index.ts');

      expect(result.name).toBe('@test/pkg-a');
      expect(result.version).toBe('1.0.0');
      expect(result.entryPath).toBe('packages/a/src/index.ts');
      expect(result.totalExports).toBe(10);
      expect(result.health).toBe(80);
      expect(result.driftCount).toBe(2);
    });
  });

  describe('aggregateResults', () => {
    test('aggregates empty results', () => {
      const batch = aggregateResults([]);

      expect(batch.packages).toHaveLength(0);
      expect(batch.aggregate.totalExports).toBe(0);
      expect(batch.aggregate.health).toBe(0);
    });

    test('aggregates single package', () => {
      const result: PackageResult = {
        name: '@test/single',
        version: '1.0.0',
        entryPath: 'src/index.ts',
        totalExports: 20,
        documented: 15,
        health: 75,
        driftCount: 3,
        coverageScore: 75,
        openpkg: createMockOpenPkg('@test/single', '1.0.0'),
        driftSpec: createMockDriftSpec(20, 75, 3),
      };

      const batch = aggregateResults([result]);

      expect(batch.packages).toHaveLength(1);
      expect(batch.aggregate.totalExports).toBe(20);
      expect(batch.aggregate.documented).toBe(15);
      expect(batch.aggregate.health).toBe(75);
      expect(batch.aggregate.driftCount).toBe(3);
    });

    test('aggregates multiple packages with weighted average', () => {
      const results: PackageResult[] = [
        {
          name: '@test/pkg-a',
          version: '1.0.0',
          entryPath: 'packages/a/src/index.ts',
          totalExports: 100, // 100 exports at 90% = 9000 weighted
          documented: 90,
          health: 90,
          driftCount: 2,
          coverageScore: 90,
          openpkg: createMockOpenPkg('@test/pkg-a', '1.0.0'),
          driftSpec: createMockDriftSpec(100, 90, 2),
        },
        {
          name: '@test/pkg-b',
          version: '1.0.0',
          entryPath: 'packages/b/src/index.ts',
          totalExports: 50, // 50 exports at 60% = 3000 weighted
          documented: 30,
          health: 60,
          driftCount: 5,
          coverageScore: 60,
          openpkg: createMockOpenPkg('@test/pkg-b', '1.0.0'),
          driftSpec: createMockDriftSpec(50, 60, 5),
        },
      ];

      const batch = aggregateResults(results);

      expect(batch.packages).toHaveLength(2);
      expect(batch.aggregate.totalExports).toBe(150);
      expect(batch.aggregate.documented).toBe(120);
      // Weighted average: (100*90 + 50*60) / 150 = 12000 / 150 = 80
      expect(batch.aggregate.health).toBe(80);
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
          health: 0,
          driftCount: 0,
          coverageScore: 0,
          openpkg: createMockOpenPkg('@test/empty', '1.0.0'),
          driftSpec: createMockDriftSpec(0, 0, 0),
        },
        {
          name: '@test/real',
          version: '1.0.0',
          entryPath: 'packages/real/src/index.ts',
          totalExports: 10,
          documented: 8,
          health: 80,
          driftCount: 1,
          coverageScore: 80,
          openpkg: createMockOpenPkg('@test/real', '1.0.0'),
          driftSpec: createMockDriftSpec(10, 80, 1),
        },
      ];

      const batch = aggregateResults(results);

      // Empty package doesn't affect weighted average
      expect(batch.aggregate.totalExports).toBe(10);
      expect(batch.aggregate.health).toBe(80);
    });
  });
});
