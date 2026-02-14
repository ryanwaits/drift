/**
 * Tests for computeHealth() function.
 */
import { describe, expect, test } from 'bun:test';
import type { SpecExport } from '@openpkg-ts/spec';
import { computeHealth, type HealthInput, isExportDocumented } from '../src/analysis/health';

/**
 * Create a minimal HealthInput for testing.
 */
function createHealthInput(overrides: Partial<HealthInput> = {}): HealthInput {
  return {
    coverageScore: 100,
    documentedExports: 10,
    totalExports: 10,
    missingByRule: {
      description: 0,
      params: 0,
      returns: 0,
      examples: 0,
      throws: 0,
    },
    driftIssues: 0,
        driftByCategory: {
      structural: 0,
      semantic: 0,
      example: 0,
    },
    ...overrides,
  };
}

describe('computeHealth', () => {
  describe('high health scenarios', () => {
    test('perfect docs, no drift → 100 health', () => {
      const input = createHealthInput({
        coverageScore: 100,
        documentedExports: 10,
        totalExports: 10,
        driftIssues: 0,
      });

      const result = computeHealth(input);

      expect(result.score).toBe(100);
      expect(result.completeness.score).toBe(100);
      expect(result.accuracy.score).toBe(100);
    });

    test('good docs (85%), no drift → 85 health', () => {
      const input = createHealthInput({
        coverageScore: 85,
        documentedExports: 17,
        totalExports: 20,
        driftIssues: 0,
      });

      const result = computeHealth(input);

      expect(result.score).toBe(85);
      expect(result.completeness.score).toBe(85);
      expect(result.accuracy.score).toBe(100);
    });
  });

  describe('medium health scenarios', () => {
    test('good docs (85%), some drift → reduced health (~78%)', () => {
      // 85% coverage, 4 drift issues out of 24 total exports
      // drift_ratio = 4/24 = 0.167, penalty = 0.167 * 0.5 = 0.083
      // accuracy = (1 - 0.083) * 100 = 92
      // health = 85 * (1 - 0.083) = 77.9 → 78
      const input = createHealthInput({
        coverageScore: 85,
        documentedExports: 20,
        totalExports: 24,
        driftIssues: 4,
                driftByCategory: {
          structural: 3,
          semantic: 1,
          example: 0,
        },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(78);
      expect(result.completeness.score).toBe(85);
      expect(result.accuracy.score).toBe(92);
      expect(result.accuracy.issues).toBe(4);
    });

    test('moderate docs (70%), light drift → ~67% health', () => {
      // 70% coverage, 2 drift issues out of 20 total exports
      // drift_ratio = 2/20 = 0.1, penalty = 0.1 * 0.5 = 0.05
      // accuracy = (1 - 0.05) * 100 = 95
      // health = 70 * (1 - 0.05) = 66.5 → 67
      const input = createHealthInput({
        coverageScore: 70,
        documentedExports: 14,
        totalExports: 20,
        driftIssues: 2,
        driftByCategory: {
          structural: 2,
          semantic: 0,
          example: 0,
        },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(67);
      expect(result.completeness.score).toBe(70);
      expect(result.accuracy.score).toBe(95);
    });
  });

  describe('low health scenarios', () => {
    test('bad docs (50%), lots of drift → low health (~38%)', () => {
      // 50% coverage, 10 drift issues out of 20 total exports
      // drift_ratio = 10/20 = 0.5, penalty = 0.5 * 0.5 = 0.25
      // accuracy = (1 - 0.25) * 100 = 75
      // health = 50 * (1 - 0.25) = 37.5 → 38
      const input = createHealthInput({
        coverageScore: 50,
        documentedExports: 10,
        totalExports: 20,
        driftIssues: 10,
                driftByCategory: {
          structural: 6,
          semantic: 2,
          example: 2,
        },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(38);
      expect(result.completeness.score).toBe(50);
      expect(result.accuracy.score).toBe(75);
    });

    test('poor docs (40%), some drift → ~37% health', () => {
      // 40% coverage, 3 drift issues out of 20 total exports
      // drift_ratio = 3/20 = 0.15, penalty = 0.15 * 0.5 = 0.075
      // accuracy = (1 - 0.075) * 100 = 92.5 → 93
      // health = 40 * (1 - 0.075) = 37
      const input = createHealthInput({
        coverageScore: 40,
        documentedExports: 8,
        totalExports: 20,
        driftIssues: 3,
        driftByCategory: {
          structural: 2,
          semantic: 1,
          example: 0,
        },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(37);
      expect(result.completeness.score).toBe(40);
      expect(result.accuracy.score).toBe(93);
    });
  });

  describe('drift penalty cap', () => {
    test('max drift penalty capped at 50%', () => {
      // 80% coverage, 100 drift issues out of 10 documented (10:1 ratio)
      // drift_ratio = 100/10 = 10.0, penalty = 10.0 * 0.5 = 5.0 → capped at 0.5
      // accuracy = (1 - 0.5) * 100 = 50
      // health = 80 * (1 - 0.5) = 40
      const input = createHealthInput({
        coverageScore: 80,
        documentedExports: 10,
        totalExports: 12,
        driftIssues: 100, // extreme case
        driftByCategory: {
          structural: 50,
          semantic: 30,
          example: 20,
        },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(40);
      expect(result.accuracy.score).toBe(50); // capped at 50% penalty
    });

    test('drift ratio > 1 still caps at 50% penalty', () => {
      const input = createHealthInput({
        coverageScore: 100,
        documentedExports: 5,
        totalExports: 5,
        driftIssues: 20, // 4x ratio
      });

      const result = computeHealth(input);

      expect(result.score).toBe(50); // 100 * 0.5
      expect(result.accuracy.score).toBe(50);
    });
  });

  describe('example validation', () => {
    test('with passing examples → no penalty', () => {
      const input = createHealthInput({
        coverageScore: 80,
        documentedExports: 16,
        totalExports: 20,
        driftIssues: 0,
        examples: { passed: 10, failed: 0, total: 10 },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(80);
      expect(result.examples).toBeDefined();
      expect(result.examples!.score).toBe(100);
      expect(result.examples!.passed).toBe(10);
      expect(result.examples!.failed).toBe(0);
    });

    test('with failing examples → up to 30% penalty', () => {
      // 80% coverage, no drift, but all examples fail
      // example_score = 0/10 = 0, penalty = (100-0)/100 * 0.3 = 0.3
      // health = 80 * (1 - 0.3) = 56
      const input = createHealthInput({
        coverageScore: 80,
        documentedExports: 16,
        totalExports: 20,
        driftIssues: 0,
        examples: { passed: 0, failed: 10, total: 10 },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(56);
      expect(result.examples!.score).toBe(0);
    });

    test('with 50% failing examples → 15% penalty', () => {
      // 80% coverage, no drift, 50% examples pass
      // example_score = 5/10 = 50%, penalty = (100-50)/100 * 0.3 = 0.15
      // health = 80 * (1 - 0.15) = 68
      const input = createHealthInput({
        coverageScore: 80,
        documentedExports: 16,
        totalExports: 20,
        driftIssues: 0,
        examples: { passed: 5, failed: 5, total: 10 },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(68);
      expect(result.examples!.score).toBe(50);
    });

    test('with no examples → no example penalty', () => {
      const input = createHealthInput({
        coverageScore: 80,
        documentedExports: 16,
        totalExports: 20,
        driftIssues: 0,
        examples: undefined,
      });

      const result = computeHealth(input);

      expect(result.score).toBe(80);
      expect(result.examples).toBeUndefined();
    });

    test('combined drift and example penalties', () => {
      // 80% coverage, 4 drift issues out of 25 total exports
      // drift_ratio = 4/25 = 0.16, drift_penalty = 0.08
      // accuracy = (1 - 0.08) * 100 = 92
      // after drift: 80 * (1 - 0.08) = 73.6
      // 50% examples fail: penalty = 0.15
      // final: 73.6 * (1 - 0.15) = 62.56 → 63
      const input = createHealthInput({
        coverageScore: 80,
        documentedExports: 20,
        totalExports: 25,
        driftIssues: 4,
        driftByCategory: {
          structural: 2,
          semantic: 2,
          example: 0,
        },
        examples: { passed: 5, failed: 5, total: 10 },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(63);
      expect(result.accuracy.score).toBe(92);
      expect(result.examples!.score).toBe(50);
    });
  });

  describe('edge cases', () => {
    test('zero drift issues → 100% accuracy', () => {
      const input = createHealthInput({
        coverageScore: 0,
        documentedExports: 0,
        totalExports: 10,
        driftIssues: 0,
      });

      const result = computeHealth(input);

      expect(result.score).toBe(0);
      expect(result.accuracy.score).toBe(100);
    });

    test('zero total exports → valid result', () => {
      const input = createHealthInput({
        coverageScore: 100,
        documentedExports: 0,
        totalExports: 0,
        driftIssues: 0,
      });

      const result = computeHealth(input);

      expect(result.score).toBe(100);
      expect(result.completeness.total).toBe(0);
    });

    test('examples with zero total → no penalty', () => {
      const input = createHealthInput({
        coverageScore: 80,
        examples: { passed: 0, failed: 0, total: 0 },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(80);
      // examples object still present, score is undefined since total=0
      expect(result.examples).toBeDefined();
      expect(result.examples!.total).toBe(0);
    });
  });

  describe('output structure', () => {
    test('includes all completeness fields', () => {
      const input = createHealthInput({
        coverageScore: 75,
        documentedExports: 15,
        totalExports: 20,
        missingByRule: {
          description: 3,
          params: 2,
          returns: 0,
          examples: 5,
          throws: 0,
        },
      });

      const result = computeHealth(input);

      expect(result.completeness.score).toBe(75);
      expect(result.completeness.documented).toBe(15);
      expect(result.completeness.total).toBe(20);
      expect(result.completeness.missing.description).toBe(3);
      expect(result.completeness.missing.params).toBe(2);
      expect(result.completeness.missing.examples).toBe(5);
    });

    test('includes all accuracy fields', () => {
      const input = createHealthInput({
        driftIssues: 5,
                driftByCategory: {
          structural: 2,
          semantic: 2,
          example: 1,
        },
      });

      const result = computeHealth(input);

      expect(result.accuracy.issues).toBe(5);
      expect(result.accuracy.byCategory.structural).toBe(2);
      expect(result.accuracy.byCategory.semantic).toBe(2);
      expect(result.accuracy.byCategory.example).toBe(1);
    });

    test('includes example fields when provided', () => {
      const input = createHealthInput({
        examples: { passed: 7, failed: 3, total: 10 },
      });

      const result = computeHealth(input);

      expect(result.examples).toBeDefined();
      expect(result.examples!.passed).toBe(7);
      expect(result.examples!.failed).toBe(3);
      expect(result.examples!.total).toBe(10);
      expect(result.examples!.score).toBe(70);
    });
  });
});

describe('isExportDocumented', () => {
  function createExport(overrides: Partial<SpecExport>): SpecExport {
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
