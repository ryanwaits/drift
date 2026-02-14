/**
 * Tests for drift suggestion fields (expected, actual, suggestion).
 */

import type { ApiExport } from '../src/analysis/api-spec';
import { describe, expect, it } from 'vitest';
import {
  detectAsyncMismatch,
  detectDeprecatedDrift,
  detectGenericConstraintDrift,
  detectOptionalityDrift,
  detectParamDrift,
  detectParamTypeDrift,
  detectPropertyTypeDrift,
  detectReturnTypeDrift,
  detectVisibilityDrift,
} from '../src/analysis/drift';

function createExport(overrides: Partial<ApiExport>): ApiExport {
  return {
    id: 'test',
    name: 'test',
    kind: 'function',
    ...overrides,
  };
}

describe('drift suggestion fields', () => {
  describe('param-mismatch', () => {
    it('includes expected and actual for missing param', () => {
      const entry = createExport({
        signatures: [
          {
            parameters: [{ name: 'name' }, { name: 'age' }],
          },
        ],
        tags: [
          {
            name: 'param',
            text: '{string} invalidParam',
            param: { name: 'invalidParam', type: 'string' },
          },
        ],
      });

      const drifts = detectParamDrift(entry);
      expect(drifts).toHaveLength(1);
      expect(drifts[0].type).toBe('param-mismatch');
      expect(drifts[0].expected).toBe('invalidParam');
      expect(drifts[0].actual).toBe('name, age');
      expect(drifts[0].suggestion).toContain('Available parameters');
    });
  });

  describe('param-type-mismatch', () => {
    it('includes expected and actual types', () => {
      const entry = createExport({
        signatures: [
          {
            parameters: [{ name: 'count', schema: { type: 'number' } }],
          },
        ],
        tags: [{ name: 'param', text: '{string} count', param: { name: 'count', type: 'string' } }],
      });

      const drifts = detectParamTypeDrift(entry);
      expect(drifts).toHaveLength(1);
      expect(drifts[0].type).toBe('param-type-mismatch');
      expect(drifts[0].expected).toBe('string');
      expect(drifts[0].actual).toBe('number');
      expect(drifts[0].suggestion).toContain('Update @param');
    });
  });

  describe('optionality-mismatch', () => {
    it('includes expected and actual for optional documented as required', () => {
      const entry = createExport({
        signatures: [
          {
            parameters: [{ name: 'name', required: false }],
          },
        ],
        tags: [
          {
            name: 'param',
            text: '{string} name',
            param: { name: 'name', type: 'string', optional: false },
          },
        ],
      });

      const drifts = detectOptionalityDrift(entry);
      expect(drifts).toHaveLength(1);
      expect(drifts[0].type).toBe('optionality-mismatch');
      expect(drifts[0].expected).toBe('name');
      expect(drifts[0].actual).toBe('optional');
      expect(drifts[0].suggestion).toContain('[name]');
    });

    it('includes expected and actual for required documented as optional', () => {
      const entry = createExport({
        signatures: [
          {
            parameters: [{ name: 'name', required: true }],
          },
        ],
        tags: [
          {
            name: 'param',
            text: '{string} [name]',
            param: { name: 'name', type: 'string', optional: true },
          },
        ],
      });

      const drifts = detectOptionalityDrift(entry);
      expect(drifts).toHaveLength(1);
      expect(drifts[0].type).toBe('optionality-mismatch');
      expect(drifts[0].expected).toBe('[name]');
      expect(drifts[0].actual).toBe('required');
    });
  });

  describe('return-type-mismatch', () => {
    it('includes expected and actual types', () => {
      const entry = createExport({
        signatures: [
          {
            returns: { schema: { type: 'number' } },
          },
        ],
        tags: [{ name: 'returns', text: '{string} the result' }],
      });

      const drifts = detectReturnTypeDrift(entry);
      expect(drifts).toHaveLength(1);
      expect(drifts[0].type).toBe('return-type-mismatch');
      expect(drifts[0].expected).toBe('string');
      expect(drifts[0].actual).toBe('number');
      expect(drifts[0].suggestion).toContain('Update @returns');
    });
  });

  describe('deprecated-mismatch', () => {
    it('includes expected and actual when code deprecated but docs not', () => {
      const entry = createExport({
        deprecated: true,
        tags: [],
      });

      const drifts = detectDeprecatedDrift(entry);
      expect(drifts).toHaveLength(1);
      expect(drifts[0].type).toBe('deprecated-mismatch');
      expect(drifts[0].expected).toBe('not deprecated');
      expect(drifts[0].actual).toBe('deprecated');
      expect(drifts[0].suggestion).toContain('@deprecated');
    });

    it('includes expected and actual when docs deprecated but code not', () => {
      const entry = createExport({
        deprecated: false,
        tags: [{ name: 'deprecated', text: 'Use newFn instead' }],
      });

      const drifts = detectDeprecatedDrift(entry);
      expect(drifts).toHaveLength(1);
      expect(drifts[0].type).toBe('deprecated-mismatch');
      expect(drifts[0].expected).toBe('@deprecated');
      expect(drifts[0].actual).toBe('not deprecated');
    });
  });

  describe('visibility-mismatch', () => {
    it('includes expected and actual visibility', () => {
      const entry = createExport({
        tags: [{ name: 'internal', text: '' }],
      });

      const drifts = detectVisibilityDrift(entry);
      expect(drifts).toHaveLength(1);
      expect(drifts[0].type).toBe('visibility-mismatch');
      expect(drifts[0].expected).toBe('@internal');
      expect(drifts[0].actual).toBe('public');
    });
  });

  describe('async-mismatch', () => {
    it('includes expected and actual for Promise not documented', () => {
      const entry = createExport({
        signatures: [
          {
            returns: { schema: { type: 'Promise<string>' } },
          },
        ],
        tags: [],
      });

      const drifts = detectAsyncMismatch(entry);
      expect(drifts).toHaveLength(1);
      expect(drifts[0].type).toBe('async-mismatch');
      expect(drifts[0].expected).toBe('sync');
      expect(drifts[0].actual).toBe('Promise');
    });
  });

  describe('property-type-drift', () => {
    it('includes expected and actual types', () => {
      const entry = createExport({
        kind: 'class',
        members: [
          {
            name: 'count',
            kind: 'property',
            schema: { type: 'number' },
            tags: [{ name: 'type', text: '{string}' }],
          },
        ],
      });

      const drifts = detectPropertyTypeDrift(entry);
      expect(drifts).toHaveLength(1);
      expect(drifts[0].type).toBe('property-type-drift');
      expect(drifts[0].expected).toBe('string');
      expect(drifts[0].actual).toBe('number');
    });
  });

  describe('generic-constraint-mismatch', () => {
    it('includes expected and actual constraints', () => {
      const entry = createExport({
        signatures: [
          {
            typeParameters: [{ name: 'T', constraint: 'string' }],
          },
        ],
        tags: [{ name: 'template', text: 'T extends number' }],
      });

      const drifts = detectGenericConstraintDrift(entry);
      expect(drifts).toHaveLength(1);
      expect(drifts[0].type).toBe('generic-constraint-mismatch');
      expect(drifts[0].expected).toBe('number');
      expect(drifts[0].actual).toBe('string');
    });
  });
});
