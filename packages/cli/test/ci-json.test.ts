/**
 * Tests for CI-friendly JSON output
 */
import { describe, expect, test } from 'bun:test';
import type { DocCovReport } from '@doccov/sdk';
import { formatCIJson } from '../src/reports/json';

// Mock report for testing
const mockReport: DocCovReport = {
  $schema: 'https://doccov.com/schemas/v1.0.0/report.schema.json',
  version: '1.0.0',
  generatedAt: '2024-01-01T00:00:00Z',
  spec: {
    name: 'test-package',
    version: '1.0.0',
  },
  coverage: {
    score: 75,
    totalExports: 10,
    documentedExports: 8,
    missingByRule: { description: 2 },
    driftCount: 3,
    driftSummary: {
      total: 3,
      fixable: 2,
      byCategory: { structural: 1, semantic: 1, example: 1 },
    },
  },
  exports: {},
  health: {
    score: 80,
    completeness: { score: 85, total: 10, missing: { description: 2 } },
    accuracy: { score: 90, issues: 1, fixable: 1, byCategory: { structural: 1 } },
  },
};

describe('formatCIJson', () => {
  test('returns success=true when health >= minHealth', () => {
    const result = formatCIJson(mockReport, { minHealth: 80 });
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  test('returns success=false when health < minHealth', () => {
    const result = formatCIJson(mockReport, { minHealth: 90 });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  test('includes threshold status', () => {
    const result = formatCIJson(mockReport, { minHealth: 80 });
    expect(result.thresholds.health).toEqual({
      min: 80,
      actual: 80,
      passed: true,
    });
  });

  test('includes drift summary', () => {
    const result = formatCIJson(mockReport);
    expect(result.drift).toEqual({
      total: 3,
      fixable: 2,
    });
  });

  test('includes exports summary', () => {
    const result = formatCIJson(mockReport);
    expect(result.exports).toEqual({
      total: 10,
      documented: 8,
    });
  });

  test('defaults minHealth to 0 when not specified', () => {
    const result = formatCIJson(mockReport);
    expect(result.thresholds.health.min).toBe(0);
    expect(result.success).toBe(true);
  });

  test('returns success=false when hasTypecheckErrors=true', () => {
    const result = formatCIJson(mockReport, { minHealth: 0, hasTypecheckErrors: true });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  test('returns success=false when hasRuntimeErrors=true', () => {
    const result = formatCIJson(mockReport, { minHealth: 0, hasRuntimeErrors: true });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  test('returns success=false when hasStaleRefs=true', () => {
    const result = formatCIJson(mockReport, { minHealth: 0, hasStaleRefs: true });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  test('includes full report in output', () => {
    const result = formatCIJson(mockReport);
    expect(result.report).toBe(mockReport);
  });

  test('uses coverage.score when health is not present', () => {
    const reportWithoutHealth: DocCovReport = {
      ...mockReport,
      health: undefined,
    };
    const result = formatCIJson(reportWithoutHealth, { minHealth: 75 });
    expect(result.health).toBe(75); // Falls back to coverage.score
    expect(result.success).toBe(true);
  });
});
