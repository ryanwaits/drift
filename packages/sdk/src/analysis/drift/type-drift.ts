import type { ApiExport } from '../api-spec';
import type { SpecDocDrift, SpecMemberWithType } from './types';
import {
  buildGenericConstraintMismatchIssue,
  buildGenericConstraintSuggestion,
  buildReturnTypeMismatchIssue,
  collectActualTypeParameterConstraints,
  extractReturnTypeFromTag,
  extractTypeFromBraces,
  extractTypeFromSchema,
  normalizeType,
  parseTemplateTag,
  typesEquivalent,
} from './utils';

/**
 * Detect mismatches between documented @returns type and actual return type.
 */
export function detectReturnTypeDrift(entry: ApiExport): SpecDocDrift[] {
  const returnsTag = entry.tags?.find((tag) => tag.name === 'returns' && tag.text?.length);
  if (!returnsTag) {
    return [];
  }

  const documentedType = extractReturnTypeFromTag(returnsTag.text);
  if (!documentedType) {
    return [];
  }

  const signatureWithReturns = entry.signatures?.find((signature) => signature.returns);
  const signatureReturn = signatureWithReturns?.returns;
  if (!signatureReturn) {
    return [];
  }

  const declaredRaw = extractTypeFromSchema(signatureReturn.schema);
  const declaredType = normalizeType(declaredRaw) ?? undefined;

  if (!declaredType) {
    return [];
  }

  const documentedNormalized = normalizeType(documentedType);
  if (!documentedNormalized) {
    return [];
  }

  if (typesEquivalent(documentedNormalized, declaredType)) {
    return [];
  }

  return [
    {
      type: 'return-type-mismatch',
      target: 'returns',
      issue: buildReturnTypeMismatchIssue(documentedType, documentedNormalized, declaredType),
      expected: documentedType,
      actual: declaredType,
      suggestion: `Update @returns to ${declaredType}.`,
    },
  ];
}

/**
 * Detect mismatches between documented @template constraints and actual type parameter constraints.
 */
export function detectGenericConstraintDrift(entry: ApiExport): SpecDocDrift[] {
  const templateTags =
    entry.tags?.filter((tag) => tag.name === 'template' && Boolean(tag.text?.trim())) ?? [];
  if (templateTags.length === 0) {
    return [];
  }

  const documentedTemplates = templateTags
    .map((tag) => parseTemplateTag(tag.text))
    .filter((template): template is NonNullable<typeof template> => Boolean(template?.name));
  if (documentedTemplates.length === 0) {
    return [];
  }

  const actualConstraints = collectActualTypeParameterConstraints(entry);
  if (actualConstraints.size === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];
  for (const doc of documentedTemplates) {
    if (!actualConstraints.has(doc.name)) {
      continue;
    }

    const actualConstraint = actualConstraints.get(doc.name);
    const normalizedActual = normalizeType(actualConstraint);
    const normalizedDocumented = normalizeType(doc.constraint);

    if (!normalizedActual && !normalizedDocumented) {
      continue;
    }

    if (normalizedActual === normalizedDocumented) {
      continue;
    }

    drifts.push({
      type: 'generic-constraint-mismatch',
      target: doc.name,
      issue: buildGenericConstraintMismatchIssue(doc.name, doc.constraint, actualConstraint),
      expected: doc.constraint ?? 'none',
      actual: actualConstraint ?? 'none',
      suggestion: buildGenericConstraintSuggestion(doc.name, actualConstraint),
    });
  }

  return drifts;
}

/**
 * Detect mismatches between documented @type and actual property types.
 */
export function detectPropertyTypeDrift(entry: ApiExport): SpecDocDrift[] {
  const members = entry.members ?? [];
  if (members.length === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  for (const member of members) {
    const typedMember = member as SpecMemberWithType;
    if (typedMember.kind !== 'property') continue;

    // Find @type tag in member tags
    const typeTag = typedMember.tags?.find((tag) => tag.name === 'type');
    if (!typeTag?.text) continue;

    // Extract documented type from @type {Type}
    const documentedType = extractTypeFromBraces(typeTag.text);
    if (!documentedType) continue;

    // Get actual type from schema
    const actualType = extractTypeFromSchema(typedMember.schema);
    if (!actualType) continue;

    // Compare (using existing normalizeType and typesEquivalent)
    const normalizedDoc = normalizeType(documentedType);
    const normalizedActual = normalizeType(actualType);

    if (!normalizedDoc || !normalizedActual) continue;

    if (!typesEquivalent(normalizedDoc, normalizedActual)) {
      const memberName = typedMember.name ?? typedMember.id ?? 'property';
      drifts.push({
        type: 'property-type-drift',
        target: memberName,
        issue: `Property "${memberName}" documented as {${documentedType}} but actual type is ${actualType}.`,
        expected: documentedType,
        actual: actualType,
        suggestion: `Update @type {${actualType}} to match the declaration.`,
      });
    }
  }

  return drifts;
}
