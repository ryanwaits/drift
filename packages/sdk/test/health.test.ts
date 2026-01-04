/**
 * Tests for computeHealth() function.
 */
import { describe, expect, test } from 'bun:test';
import { computeHealth, type HealthInput } from '../src/analysis/health';

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
    fixableDrift: 0,
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
    test('good docs (85%), some drift → reduced health (~75%)', () => {
      // 85% coverage, 4 drift issues out of 20 documented exports
      // drift_ratio = 4/20 = 0.2, penalty = 0.2 * 0.5 = 0.1
      // accuracy = (1 - 0.1) * 100 = 90
      // health = 85 * (1 - 0.1) = 76.5 → 77
      const input = createHealthInput({
        coverageScore: 85,
        documentedExports: 20,
        totalExports: 24,
        driftIssues: 4,
        fixableDrift: 2,
        driftByCategory: {
          structural: 3,
          semantic: 1,
          example: 0,
        },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(77);
      expect(result.completeness.score).toBe(85);
      expect(result.accuracy.score).toBe(90);
      expect(result.accuracy.issues).toBe(4);
      expect(result.accuracy.fixable).toBe(2);
    });

    test('moderate docs (70%), light drift → ~65% health', () => {
      // 70% coverage, 2 drift issues out of 14 documented
      // drift_ratio = 2/14 = 0.143, penalty = 0.143 * 0.5 = 0.0714
      // accuracy = (1 - 0.0714) * 100 = 92.86 → 93
      // health = 70 * (1 - 0.0714) = 65 → 65
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

      expect(result.score).toBe(65);
      expect(result.completeness.score).toBe(70);
      expect(result.accuracy.score).toBe(93);
    });
  });

  describe('low health scenarios', () => {
    test('bad docs (50%), lots of drift → low health (~45%)', () => {
      // 50% coverage, 10 drift issues out of 10 documented
      // drift_ratio = 10/10 = 1.0, penalty = 1.0 * 0.5 = 0.5 (capped at max)
      // accuracy = (1 - 0.5) * 100 = 50
      // health = 50 * (1 - 0.5) = 25
      const input = createHealthInput({
        coverageScore: 50,
        documentedExports: 10,
        totalExports: 20,
        driftIssues: 10,
        fixableDrift: 5,
        driftByCategory: {
          structural: 6,
          semantic: 2,
          example: 2,
        },
      });

      const result = computeHealth(input);

      expect(result.score).toBe(25);
      expect(result.completeness.score).toBe(50);
      expect(result.accuracy.score).toBe(50);
    });

    test('poor docs (40%), some drift → ~35% health', () => {
      // 40% coverage, 3 drift issues out of 8 documented
      // drift_ratio = 3/8 = 0.375, penalty = 0.375 * 0.5 = 0.1875
      // accuracy = (1 - 0.1875) * 100 = 81.25 → 81
      // health = 40 * (1 - 0.1875) = 32.5 → 33
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

      expect(result.score).toBe(33);
      expect(result.completeness.score).toBe(40);
      expect(result.accuracy.score).toBe(81);
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
      // 80% coverage, 20% drift penalty (4 issues / 20 documented)
      // drift_ratio = 4/20 = 0.2, drift_penalty = 0.1
      // after drift: 80 * (1 - 0.1) = 72
      // 50% examples fail: penalty = 0.15
      // final: 72 * (1 - 0.15) = 61.2 → 61
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

      expect(result.score).toBe(61);
      expect(result.accuracy.score).toBe(90);
      expect(result.examples!.score).toBe(50);
    });
  });

  describe('edge cases', () => {
    test('zero documented exports → no drift penalty', () => {
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
        fixableDrift: 3,
        driftByCategory: {
          structural: 2,
          semantic: 2,
          example: 1,
        },
      });

      const result = computeHealth(input);

      expect(result.accuracy.issues).toBe(5);
      expect(result.accuracy.fixable).toBe(3);
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
