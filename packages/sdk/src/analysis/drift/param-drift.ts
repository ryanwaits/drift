import type { SpecExport } from '@openpkg-ts/spec';
import type { ParsedParamTag, SpecDocDrift } from './types';
import {
  buildParamTypeMismatchIssue,
  extractParamFromTag,
  extractTypeFromSchema,
  findClosestMatch,
  normalizeType,
  typesEquivalent,
} from './utils';

/**
 * Detect mismatches between documented @param names and actual signature params.
 */
export function detectParamDrift(entry: SpecExport): SpecDocDrift[] {
  const drifts: SpecDocDrift[] = [];
  const signatures = entry.signatures ?? [];
  if (signatures.length === 0) {
    return drifts;
  }

  // Build map of param names to their schema properties (for destructured params)
  const actualParamNames = new Set<string>();
  const paramProperties = new Map<string, Set<string>>();

  for (const signature of signatures) {
    for (const param of signature.parameters ?? []) {
      if (param.name) {
        actualParamNames.add(param.name);

        // Extract properties from schema for destructured param matching
        const schema = param.schema as Record<string, unknown> | undefined;
        if (schema?.properties && typeof schema.properties === 'object') {
          const propNames = new Set(Object.keys(schema.properties as Record<string, unknown>));
          paramProperties.set(param.name, propNames);
        }
      }
    }
  }

  if (actualParamNames.size === 0) {
    return drifts;
  }

  const documentedParamNames = (entry.tags ?? [])
    .filter((tag) => tag.name === 'param')
    .map((tag) => extractParamFromTag(tag)?.name)
    .filter((name): name is string => Boolean(name));

  if (documentedParamNames.length === 0) {
    return drifts;
  }

  for (const documentedName of documentedParamNames) {
    // Direct match (e.g., "name" matches "name")
    if (actualParamNames.has(documentedName)) {
      continue;
    }

    // Handle destructured param notation (e.g., "opts.name" or "options.model")
    if (documentedName.includes('.')) {
      const [prefix, ...rest] = documentedName.split('.');
      const propertyPath = rest.join('.');

      // Check if prefix matches an actual param
      if (actualParamNames.has(prefix)) {
        const properties = paramProperties.get(prefix);

        // If param has properties, check if the documented property exists
        if (properties) {
          // For nested paths like opts.config.host, just check the first level
          const firstProperty = rest[0];
          if (properties.has(firstProperty)) {
            continue; // Property exists, no drift
          }

          // Property doesn't exist - find closest match among actual properties
          const propsArray = Array.from(properties);
          const suggestion = findClosestMatch(firstProperty, propsArray);

          // Build suggestion: either a close match, or list available properties
          let suggestionText: string | undefined;
          if (suggestion) {
            suggestionText = `Did you mean "${prefix}.${suggestion.value}"?`;
          } else if (propsArray.length > 0 && propsArray.length <= 8) {
            // List available properties if there aren't too many
            const propsList = propsArray.slice(0, 5).map((p) => `${prefix}.${p}`);
            suggestionText =
              propsArray.length > 5
                ? `Available: ${propsList.join(', ')}... (${propsArray.length} total)`
                : `Available: ${propsList.join(', ')}`;
          }

          drifts.push({
            type: 'param-mismatch',
            target: documentedName,
            issue: `JSDoc documents property "${propertyPath}" on parameter "${prefix}" which does not exist.`,
            expected: documentedName,
            actual:
              propsArray.length > 0
                ? propsArray.map((p) => `${prefix}.${p}`).join(', ')
                : undefined,
            suggestion: suggestionText,
          });
          continue;
        }

        // Param exists but has no extractable properties (e.g., external type)
        // Don't report drift - we can't verify
        continue;
      }

      // Prefix doesn't match any actual param — check if this is a destructured
      // documentation pattern where `@param options.model` documents a destructured
      // param `({model, ...}: Options)`. The property name should match an actual param.
      const firstProperty = rest[0];
      if (actualParamNames.has(firstProperty)) {
        continue; // Valid destructured param documentation
      }
    }

    // Handle bare container param (e.g., `@param options` when function has destructured params)
    // If there are other `@param options.X` docs where X matches actual params, this is the container
    if (!documentedName.includes('.')) {
      const isContainer = documentedParamNames.some((other) => {
        if (!other.startsWith(`${documentedName}.`)) return false;
        const prop = other.split('.')[1];
        return actualParamNames.has(prop);
      });
      if (isContainer) continue;
    }

    // No match found - report drift
    const paramsArray = Array.from(actualParamNames);
    const suggestion = findClosestMatch(documentedName, paramsArray);

    // Build suggestion: either a close match, or list available params
    let suggestionText: string | undefined;
    if (suggestion) {
      suggestionText = `Did you mean "${suggestion.value}"?`;
    } else if (paramsArray.length > 0 && paramsArray.length <= 6) {
      suggestionText = `Available parameters: ${paramsArray.join(', ')}`;
    }

    drifts.push({
      type: 'param-mismatch',
      target: documentedName,
      issue: `JSDoc documents parameter "${documentedName}" which is not present in the signature.`,
      expected: documentedName,
      actual: paramsArray.join(', ') || undefined,
      suggestion: suggestionText,
    });
  }

  return drifts;
}

/**
 * Detect mismatches between documented optionality (brackets) and actual signature.
 */
export function detectOptionalityDrift(entry: SpecExport): SpecDocDrift[] {
  const signatures = entry.signatures ?? [];
  if (signatures.length === 0) {
    return [];
  }

  const actualOptionality = new Map<string, boolean>();
  for (const signature of signatures) {
    for (const param of signature.parameters ?? []) {
      if (!param.name || actualOptionality.has(param.name)) {
        continue;
      }
      actualOptionality.set(param.name, param.required === false);
    }
  }

  if (actualOptionality.size === 0) {
    return [];
  }

  const documentedParams = (entry.tags ?? [])
    .filter((tag) => tag.name === 'param')
    .map((tag) => extractParamFromTag(tag))
    .filter((parsed): parsed is ParsedParamTag & { name: string } => Boolean(parsed?.name));

  if (documentedParams.length === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  for (const docParam of documentedParams) {
    const actualOptional = actualOptionality.get(docParam.name);
    if (actualOptional === undefined) {
      continue;
    }

    const documentedOptional = Boolean(docParam.isOptional);
    if (actualOptional === documentedOptional) {
      continue;
    }

    const issue = documentedOptional
      ? `JSDoc marks parameter "${docParam.name}" optional but the signature requires it.`
      : `JSDoc omits optional brackets for parameter "${docParam.name}" but the signature marks it optional.`;
    const suggestion = documentedOptional
      ? `Remove brackets around ${docParam.name} or mark the parameter optional in the signature.`
      : `Document ${docParam.name} as [${docParam.name}] or make it required in the signature.`;

    drifts.push({
      type: 'optionality-mismatch',
      target: docParam.name,
      issue,
      expected: documentedOptional ? `[${docParam.name}]` : docParam.name,
      actual: actualOptional ? 'optional' : 'required',
      suggestion,
    });
  }

  return drifts;
}

/**
 * Detect mismatches between documented @param types and actual signature types.
 */
export function detectParamTypeDrift(entry: SpecExport): SpecDocDrift[] {
  const signatures = entry.signatures ?? [];
  if (signatures.length === 0) {
    return [];
  }

  const documentedParams = (entry.tags ?? [])
    .filter((tag) => tag.name === 'param')
    .map((tag) => extractParamFromTag(tag))
    .filter(
      (parsed): parsed is ParsedParamTag & { name: string; type: string } =>
        Boolean(parsed?.name) && Boolean(parsed?.type),
    );

  if (documentedParams.length === 0) {
    return [];
  }

  const declaredParamTypes = new Map<string, string>();
  for (const signature of signatures) {
    for (const param of signature.parameters ?? []) {
      if (!param.name || declaredParamTypes.has(param.name)) {
        continue;
      }
      const declaredType = extractTypeFromSchema(param.schema);
      if (declaredType) {
        declaredParamTypes.set(param.name, declaredType);
      }
    }
  }

  if (declaredParamTypes.size === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];
  for (const documentedParam of documentedParams) {
    const declaredType = declaredParamTypes.get(documentedParam.name);
    if (!declaredType || !documentedParam.type) {
      continue;
    }

    const documentedNormalized = normalizeType(documentedParam.type);
    const declaredNormalized = normalizeType(declaredType);

    if (!documentedNormalized || !declaredNormalized) {
      continue;
    }

    if (typesEquivalent(documentedNormalized, declaredNormalized)) {
      continue;
    }

    drifts.push({
      type: 'param-type-mismatch',
      target: documentedParam.name,
      issue: buildParamTypeMismatchIssue(documentedParam.name, documentedParam.type, declaredType),
      expected: documentedParam.type,
      actual: declaredType,
      suggestion: `Update @param {${declaredType}} ${documentedParam.name} to match the signature.`,
    });
  }

  return drifts;
}
