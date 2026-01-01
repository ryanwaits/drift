/**
 * Deterministic fix generators for documentation drift.
 * These generate structural fixes based on drift type without LLM.
 */

import type { SpecExport } from '@openpkg-ts/spec';
import type { SpecDocDrift } from '../analysis/drift/types';
import type { JSDocParam, JSDocPatch, JSDocReturn } from './jsdoc-writer';

/**
 * Types of fixes that can be generated
 */
export type FixType =
  | 'add-param'
  | 'remove-param'
  | 'update-param-type'
  | 'update-param-optionality'
  | 'update-return-type'
  | 'update-assertion'
  | 'add-template'
  | 'update-template-constraint'
  | 'add-deprecated'
  | 'remove-deprecated'
  | 'add-async'
  | 'remove-async'
  | 'update-property-type';

/**
 * A fix suggestion with the patch to apply
 */
export interface FixSuggestion {
  type: FixType;
  driftType: SpecDocDrift['type'];
  target: string;
  description: string;
  patch: Partial<JSDocPatch>;
}

/**
 * Drift types that can be fixed deterministically
 */
const FIXABLE_DRIFT_TYPES: Set<SpecDocDrift['type']> = new Set([
  'param-mismatch',
  'param-type-mismatch',
  'optionality-mismatch',
  'return-type-mismatch',
  'generic-constraint-mismatch',
  'example-assertion-failed',
  'deprecated-mismatch',
  'async-mismatch',
  'property-type-drift',
]);

/**
 * Check if a drift type can be fixed deterministically
 */
export function isFixableDrift(drift: SpecDocDrift): boolean {
  return FIXABLE_DRIFT_TYPES.has(drift.type);
}

/**
 * Generate a fix for a single drift issue
 */
export function generateFix(
  drift: SpecDocDrift,
  exportEntry: SpecExport,
  existingPatch?: JSDocPatch,
): FixSuggestion | null {
  switch (drift.type) {
    case 'param-mismatch':
      return generateParamMismatchFix(drift, exportEntry, existingPatch);

    case 'param-type-mismatch':
      return generateParamTypeFix(drift, exportEntry, existingPatch);

    case 'optionality-mismatch':
      return generateOptionalityFix(drift, exportEntry, existingPatch);

    case 'return-type-mismatch':
      return generateReturnTypeFix(drift, exportEntry, existingPatch);

    case 'generic-constraint-mismatch':
      return generateGenericConstraintFix(drift, exportEntry, existingPatch);

    case 'example-assertion-failed':
      return generateAssertionFix(drift, exportEntry);

    case 'deprecated-mismatch':
      return generateDeprecatedFix(drift, exportEntry, existingPatch);

    case 'async-mismatch':
      return generateAsyncFix(drift, exportEntry, existingPatch);

    case 'property-type-drift':
      return generatePropertyTypeFix(drift, exportEntry, existingPatch);

    default:
      return null;
  }
}

/**
 * Generate all fixes for an export's drift issues.
 *
 * @param exportEntry - The export to generate fixes for
 * @param existingPatch - Optional existing JSDoc patch to merge with
 * @param driftList - Optional drift list from DocCovSpec (if not provided, reads from exportEntry.docs?.drift for backward compat)
 */
export function generateFixesForExport(
  exportEntry: SpecExport,
  existingPatch?: JSDocPatch,
  driftList?: SpecDocDrift[],
): FixSuggestion[] {
  const fixes: FixSuggestion[] = [];
  const drifts = driftList ?? (exportEntry as unknown as { docs?: { drift?: SpecDocDrift[] } }).docs?.drift ?? [];

  for (const drift of drifts) {
    const fix = generateFix(drift, exportEntry, existingPatch);
    if (fix) {
      fixes.push(fix);
    }
  }

  return fixes;
}

/**
 * Merge multiple fix patches into a single patch
 */
export function mergeFixes(fixes: FixSuggestion[], basePatch?: JSDocPatch): JSDocPatch {
  let result: JSDocPatch = basePatch ? { ...basePatch } : {};

  for (const fix of fixes) {
    result = mergePatches(result, fix.patch);
  }

  return result;
}

/**
 * Merge two patches together
 */
function mergePatches(base: JSDocPatch, update: Partial<JSDocPatch>): JSDocPatch {
  const result = { ...base };

  if (update.description !== undefined) {
    result.description = update.description;
  }

  if (update.params !== undefined) {
    // Detect the type of param update:
    // 1. Removal: fewer params in update than in base
    // 2. Rename/structural change: same count but different names
    // 3. Addition/modification: same or more params, preserving names
    const baseNames = new Set(result.params?.map((p) => p.name) ?? []);
    const updateNames = new Set(update.params.map((p) => p.name));

    // Check if this is a structural change (rename) - names differ but count same or similar
    const hasStructuralChange =
      result.params &&
      update.params.length === result.params.length &&
      ![...updateNames].every((name) => baseNames.has(name));

    // Check if this is a removal - fewer params in update
    const isRemoval = result.params && update.params.length < result.params.length;

    if (isRemoval || hasStructuralChange) {
      // Replace params entirely - the update.params represents the complete desired state
      // This handles both removals and renames
      result.params = update.params.map((updatedParam) => {
        // For structural changes, try to preserve descriptions from params with same name
        const existingByName = new Map(result.params?.map((p) => [p.name, p]) ?? []);
        const existing = existingByName.get(updatedParam.name);
        return {
          ...existing,
          ...updatedParam,
          description: updatedParam.description ?? existing?.description,
        };
      });
    } else {
      // Merge params by name - update specific params while preserving others
      if (!result.params) {
        result.params = [];
      }
      const resultByName = new Map(result.params.map((p) => [p.name, p]));
      for (const updatedParam of update.params) {
        const existing = resultByName.get(updatedParam.name);
        if (existing) {
          // Merge into existing param
          Object.assign(existing, updatedParam);
        } else {
          result.params.push(updatedParam);
        }
      }
    }
  }

  if (update.returns !== undefined) {
    result.returns = { ...result.returns, ...update.returns };
  }

  if (update.typeParams !== undefined) {
    result.typeParams = update.typeParams;
  }

  if (update.examples !== undefined) {
    result.examples = update.examples;
  }

  if (update.deprecated !== undefined) {
    result.deprecated = update.deprecated;
  }

  if (update.async !== undefined) {
    result.async = update.async;
  }

  if (update.type !== undefined) {
    result.type = update.type;
  }

  return result;
}

// --- Individual fix generators ---

function generateParamMismatchFix(
  drift: SpecDocDrift,
  exportEntry: SpecExport,
  existingPatch?: JSDocPatch,
): FixSuggestion | null {
  // Parse the drift issue to determine what's wrong
  const issue = drift.issue.toLowerCase();
  const target = drift.target ?? '';

  // Get actual parameters from signature
  const signature = exportEntry.signatures?.[0];
  if (!signature) return null;

  const actualParams = signature.parameters ?? [];
  const existingParams = existingPatch?.params ?? [];

  // Case: Missing parameter documentation
  if (issue.includes('missing') || issue.includes('undocumented')) {
    // Extract param name from target or issue
    const paramName = extractParamName(target, drift.issue);
    if (!paramName) return null;

    // Find the actual param to get its type
    const actualParam = actualParams.find((p) => p.name === paramName);
    const paramType = actualParam?.schema ? stringifySchema(actualParam.schema) : undefined;

    const newParam: JSDocParam = {
      name: paramName,
      type: paramType,
      optional: actualParam?.required === false,
    };

    // Merge with existing params
    const updatedParams = [...existingParams];
    const existingIndex = updatedParams.findIndex((p) => p.name === paramName);
    if (existingIndex >= 0) {
      updatedParams[existingIndex] = { ...updatedParams[existingIndex], ...newParam };
    } else {
      updatedParams.push(newParam);
    }

    return {
      type: 'add-param',
      driftType: drift.type,
      target: paramName,
      description: `Add missing @param ${paramName}`,
      patch: { params: updatedParams },
    };
  }

  // Case: Extra parameter documentation (param removed from code or doesn't exist)
  // Patterns: "extra", "removed", "no longer", "not present", "does not exist"
  if (
    issue.includes('extra') ||
    issue.includes('removed') ||
    issue.includes('no longer') ||
    issue.includes('not present') ||
    issue.includes('does not exist')
  ) {
    const paramName = target || extractParamName(target, drift.issue);
    if (!paramName) return null;

    const updatedParams = existingParams.filter((p) => p.name !== paramName);

    return {
      type: 'remove-param',
      driftType: drift.type,
      target: paramName,
      description: `Remove stale @param ${paramName}`,
      patch: { params: updatedParams },
    };
  }

  // Case: Renamed parameter (suggestion contains the new name)
  // Or: documented param doesn't match actual param name (suggest rename)
  if (drift.suggestion) {
    const oldName = extractParamName(target, drift.issue);
    // Try multiple patterns to extract the suggested new name:
    // 1. backticks: `newName`
    // 2. double quotes: "newName"
    // 3. single quotes: 'newName'
    // 4. just the word itself if it looks like a param name (no special chars)
    const newNameMatch =
      drift.suggestion.match(/[`'"](\w+)[`'"]/) ??
      drift.suggestion.match(/(?:to|use|should be)\s+[`'"]?(\w+)[`'"]?/i);
    const newName =
      newNameMatch?.[1] ??
      // Fallback: if suggestion is a simple word, use it directly
      (/^\s*\w+\s*$/.test(drift.suggestion) ? drift.suggestion.trim() : null);

    if (oldName && newName && oldName !== newName) {
      const updatedParams = existingParams.map((p) =>
        p.name === oldName ? { ...p, name: newName } : p,
      );

      return {
        type: 'add-param',
        driftType: drift.type,
        target: newName,
        description: `Rename @param ${oldName} to ${newName}`,
        patch: { params: updatedParams },
      };
    }
  }

  return null;
}

function generateParamTypeFix(
  drift: SpecDocDrift,
  exportEntry: SpecExport,
  existingPatch?: JSDocPatch,
): FixSuggestion | null {
  const target = drift.target ?? '';
  const paramName = extractParamName(target, drift.issue);
  if (!paramName) return null;

  // Get the correct type from the signature
  const signature = exportEntry.signatures?.[0];
  const actualParam = signature?.parameters?.find((p) => p.name === paramName);
  if (!actualParam) return null;

  const correctType = stringifySchema(actualParam.schema);
  const existingParams = existingPatch?.params ?? [];

  const updatedParams = existingParams.map((p) =>
    p.name === paramName ? { ...p, type: correctType } : p,
  );

  // If param doesn't exist in docs, add it
  if (!existingParams.some((p) => p.name === paramName)) {
    updatedParams.push({
      name: paramName,
      type: correctType,
      optional: actualParam.required === false,
    });
  }

  return {
    type: 'update-param-type',
    driftType: drift.type,
    target: paramName,
    description: `Update @param ${paramName} type to {${correctType}}`,
    patch: { params: updatedParams },
  };
}

function generateOptionalityFix(
  drift: SpecDocDrift,
  exportEntry: SpecExport,
  existingPatch?: JSDocPatch,
): FixSuggestion | null {
  const target = drift.target ?? '';
  const paramName = extractParamName(target, drift.issue);
  if (!paramName) return null;

  // Get the actual optionality from signature
  const signature = exportEntry.signatures?.[0];
  const actualParam = signature?.parameters?.find((p) => p.name === paramName);
  if (!actualParam) return null;

  const isOptional = actualParam.required === false;
  const existingParams = existingPatch?.params ?? [];

  const updatedParams = existingParams.map((p) =>
    p.name === paramName ? { ...p, optional: isOptional } : p,
  );

  // If param doesn't exist, add it
  if (!existingParams.some((p) => p.name === paramName)) {
    updatedParams.push({
      name: paramName,
      optional: isOptional,
    });
  }

  const optionalityText = isOptional ? 'optional' : 'required';

  return {
    type: 'update-param-optionality',
    driftType: drift.type,
    target: paramName,
    description: `Mark @param ${paramName} as ${optionalityText}`,
    patch: { params: updatedParams },
  };
}

function generateReturnTypeFix(
  drift: SpecDocDrift,
  exportEntry: SpecExport,
  existingPatch?: JSDocPatch,
): FixSuggestion | null {
  // Get the correct return type from signature
  const signature = exportEntry.signatures?.[0];
  const actualReturn = signature?.returns;
  if (!actualReturn) return null;

  const correctType = stringifySchema(actualReturn.schema);

  const updatedReturn: JSDocReturn = {
    ...existingPatch?.returns,
    type: correctType,
  };

  return {
    type: 'update-return-type',
    driftType: drift.type,
    target: 'returns',
    description: `Update @returns type to {${correctType}}`,
    patch: { returns: updatedReturn },
  };
}

function generateGenericConstraintFix(
  drift: SpecDocDrift,
  exportEntry: SpecExport,
  _existingPatch?: JSDocPatch,
): FixSuggestion | null {
  // Extract type parameter name from target
  const target = drift.target ?? '';
  const typeParamName = target || extractTypeParamName(drift.issue);
  if (!typeParamName) return null;

  // Get actual constraint from export
  const typeParam = exportEntry.typeParameters?.find((tp) => tp.name === typeParamName);
  if (!typeParam) return null;

  const typeParams =
    exportEntry.typeParameters?.map((tp) => ({
      name: tp.name,
      constraint: tp.constraint,
    })) ?? [];

  return {
    type: 'update-template-constraint',
    driftType: drift.type,
    target: typeParamName,
    description: `Update @template ${typeParamName} constraint to ${typeParam.constraint ?? 'none'}`,
    patch: { typeParams },
  };
}

function generateAssertionFix(drift: SpecDocDrift, exportEntry: SpecExport): FixSuggestion | null {
  // The suggestion should contain the corrected assertion
  if (!drift.suggestion) return null;

  // Parse target to get example index and line
  // Format: "example[0]:line5" or "example[0]"
  const targetMatch = drift.target?.match(/example\[(\d+)\](?::line(\d+))?/);
  if (!targetMatch) return null;

  const exampleIndex = parseInt(targetMatch[1], 10);
  const examples = exportEntry.examples ?? [];

  if (exampleIndex >= examples.length) return null;

  // Extract the new assertion value from suggestion
  // Suggestion format: "Update assertion to: // => 6"
  const newValueMatch = drift.suggestion.match(/\/\/\s*=>\s*(.+)$/);
  if (!newValueMatch) return null;

  const newValue = newValueMatch[1].trim();

  // Find and replace the old assertion in the example
  const oldExample = examples[exampleIndex];
  const oldValueMatch = drift.issue.match(/expected\s+"([^"]+)"/i);
  const oldValue = oldValueMatch?.[1];

  if (!oldValue) return null;

  // Handle both string and SpecExample formats
  const oldExampleCode = typeof oldExample === 'string' ? oldExample : oldExample.code;

  // Replace the assertion comment
  const updatedCode = oldExampleCode.replace(
    new RegExp(`//\\s*=>\\s*${escapeRegex(oldValue)}`, 'g'),
    `// => ${newValue}`,
  );

  // Preserve the example format (string or SpecExample object)
  const updatedExample =
    typeof oldExample === 'string' ? updatedCode : { ...oldExample, code: updatedCode };

  const updatedExamples = [...examples];
  updatedExamples[exampleIndex] = updatedExample;

  return {
    type: 'update-assertion',
    driftType: drift.type,
    target: `example[${exampleIndex}]`,
    description: `Update assertion from "${oldValue}" to "${newValue}"`,
    patch: { examples: updatedExamples as string[] },
  };
}

function generateDeprecatedFix(
  drift: SpecDocDrift,
  exportEntry: SpecExport,
  _existingPatch?: JSDocPatch,
): FixSuggestion | null {
  const issue = drift.issue.toLowerCase();
  const target = drift.target ?? exportEntry.name ?? '';

  // Case 1: Code is deprecated but docs don't have @deprecated
  if (issue.includes('missing') || issue.includes('@deprecated is missing')) {
    // Get deprecation message from the code if available
    const deprecationReason = exportEntry.deprecated
      ? typeof exportEntry.deprecated === 'string'
        ? exportEntry.deprecated
        : 'This API is deprecated.'
      : 'This API is deprecated.';

    return {
      type: 'add-deprecated',
      driftType: drift.type,
      target,
      description: `Add @deprecated tag`,
      patch: { deprecated: deprecationReason },
    };
  }

  // Case 2: Docs have @deprecated but code is not deprecated
  if (issue.includes('not') && issue.includes('deprecated')) {
    return {
      type: 'remove-deprecated',
      driftType: drift.type,
      target,
      description: `Remove @deprecated tag`,
      patch: { deprecated: false },
    };
  }

  return null;
}

function generateAsyncFix(
  drift: SpecDocDrift,
  _exportEntry: SpecExport,
  _existingPatch?: JSDocPatch,
): FixSuggestion | null {
  const issue = drift.issue.toLowerCase();

  // Case 1: Function returns Promise but docs don't indicate async
  if (issue.includes('returns promise') && issue.includes('does not indicate')) {
    // Option 1: Add @async tag
    // Option 2: Update @returns to show Promise type
    // We'll add @async tag as it's simpler and more explicit
    return {
      type: 'add-async',
      driftType: drift.type,
      target: 'returns',
      description: `Add @async tag`,
      patch: { async: true },
    };
  }

  // Case 2: Docs indicate async but function doesn't return Promise
  if (issue.includes('does not return promise') || issue.includes("doesn't return promise")) {
    // Remove @async tag
    return {
      type: 'remove-async',
      driftType: drift.type,
      target: 'returns',
      description: `Remove @async tag`,
      patch: { async: false },
    };
  }

  return null;
}

function generatePropertyTypeFix(
  drift: SpecDocDrift,
  _exportEntry: SpecExport,
  _existingPatch?: JSDocPatch,
): FixSuggestion | null {
  const target = drift.target ?? '';

  // Extract the actual type from the suggestion or issue
  // Suggestion format: "Update @type {actualType} to match the declaration."
  // Issue format: "Property "foo" documented as {docType} but actual type is actualType."
  let actualType: string | null = null;

  if (drift.suggestion) {
    const suggestionMatch = drift.suggestion.match(/\{([^}]+)\}/);
    if (suggestionMatch) {
      actualType = suggestionMatch[1];
    }
  }

  if (!actualType && drift.issue) {
    const issueMatch = drift.issue.match(/actual type is\s+(\S+)/i);
    if (issueMatch) {
      actualType = issueMatch[1].replace(/\.$/, ''); // Remove trailing period
    }
  }

  if (!actualType) return null;

  return {
    type: 'update-property-type',
    driftType: drift.type,
    target,
    description: `Update @type to {${actualType}}`,
    patch: { type: actualType },
  };
}

// --- Helper functions ---

function extractParamName(target: string, issue: string): string | null {
  // Try target first
  if (target && !target.includes('[') && !target.includes(':')) {
    return target;
  }

  // Try to extract from issue text
  // Common patterns: "Parameter `foo`", "@param foo", "param 'foo'"
  const patterns = [
    /[Pp]arameter\s+[`'"]?(\w+)[`'"]?/,
    /@param\s+(?:\{[^}]+\}\s+)?[`'"]?(\w+)[`'"]?/,
    /[`'"](\w+)[`'"]\s+(?:is|was|has)/,
  ];

  for (const pattern of patterns) {
    const match = issue.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function extractTypeParamName(issue: string): string | null {
  const match = issue.match(/[Tt]ype\s+parameter\s+[`'"]?(\w+)[`'"]?/);
  return match?.[1] ?? null;
}

function stringifySchema(schema: unknown): string {
  if (typeof schema === 'string') {
    return schema;
  }

  if (schema && typeof schema === 'object') {
    // Handle common schema shapes
    if ('type' in schema && typeof schema.type === 'string') {
      return schema.type;
    }
    if ('$ref' in schema && typeof schema.$ref === 'string') {
      // Extract type name from $ref
      const ref = schema.$ref;
      return ref.split('/').pop() ?? ref;
    }
  }

  return 'unknown';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get a summary of fixable vs non-fixable drifts
 */
export function categorizeDrifts(drifts: SpecDocDrift[]): {
  fixable: SpecDocDrift[];
  nonFixable: SpecDocDrift[];
} {
  const fixable: SpecDocDrift[] = [];
  const nonFixable: SpecDocDrift[] = [];

  for (const drift of drifts) {
    if (isFixableDrift(drift)) {
      fixable.push(drift);
    } else {
      nonFixable.push(drift);
    }
  }

  return { fixable, nonFixable };
}
