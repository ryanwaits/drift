import type { SpecExport, SpecSchema, SpecTag } from '@openpkg-ts/spec';
import type { ClosestMatch, DocumentedTemplateTag, ParsedParamTag } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Param Tag Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract param info from a SpecTag's structured param field.
 */
export function extractParamFromTag(tag: SpecTag): ParsedParamTag | undefined {
  if (!tag.param) {
    return undefined;
  }
  return {
    name: tag.param.name,
    type: tag.param.type,
    isOptional: tag.param.optional,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Return Type Parsing
// ─────────────────────────────────────────────────────────────────────────────

export function extractReturnTypeFromTag(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  // Only extract type if it's explicitly in braces {type}
  // Don't treat the first word of a description as a type
  const braceMatch = trimmed.match(/^\{([^}]+)\}/);
  if (braceMatch) {
    return braceMatch[1]?.trim();
  }

  // No braces means no explicit type - just a description
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema Type Extraction
// ─────────────────────────────────────────────────────────────────────────────

export function extractTypeFromSchema(schema: SpecSchema | undefined): string | undefined {
  if (!schema) {
    return undefined;
  }

  if (typeof schema === 'string') {
    return schema;
  }

  if (typeof schema === 'object') {
    const record = schema as Record<string, unknown>;
    if (typeof record.type === 'string') {
      return record.type;
    }
    if (typeof record.$ref === 'string') {
      const ref = record.$ref;
      return ref.startsWith('#/types/') ? ref.slice('#/types/'.length) : ref;
    }
  }

  return undefined;
}

export function extractTypeFromBraces(text: string): string | undefined {
  const match = text.match(/^\{([^}]+)\}/);
  return match?.[1]?.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Normalization and Comparison
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeType(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/\s+/g, ' ')
    .replace(/\s*<\s*/g, '<')
    .replace(/\s*>\s*/g, '>')
    .trim();
}

const VOID_EQUIVALENTS = new Set(['void', 'undefined']);

export function typesEquivalent(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();

  if (VOID_EQUIVALENTS.has(lowerA) && VOID_EQUIVALENTS.has(lowerB)) {
    return true;
  }

  return false;
}

export function unwrapPromise(type: string): string | undefined {
  const match = type.match(/^promise<(.+)>$/i);
  return match ? match[1]?.trim() : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Tag Parsing
// ─────────────────────────────────────────────────────────────────────────────

export function parseTemplateTag(text: string | undefined): DocumentedTemplateTag | undefined {
  const trimmed = text?.trim();
  if (!trimmed) {
    return undefined;
  }

  let remaining = trimmed;
  let constraint: string | undefined;

  const braceMatch = remaining.match(/^\{([^}]+)\}\s+(.+)$/);
  if (braceMatch) {
    constraint = braceMatch[1]?.trim();
    remaining = braceMatch[2]?.trim() ?? '';
  }

  if (!remaining) {
    return undefined;
  }

  const parts = remaining.split(/\s+/).filter(Boolean);
  const rawName = parts.shift();
  if (!rawName) {
    return undefined;
  }

  const name = rawName.replace(/[.,;:]+$/, '');

  if (!constraint && parts.length > 0 && parts[0] === 'extends') {
    const constraintTokens = parts.slice(1);
    const dashIndex = constraintTokens.findIndex((token) => token === '-' || token === '–');
    const tokens = dashIndex >= 0 ? constraintTokens.slice(0, dashIndex) : constraintTokens;
    constraint = tokens.join(' ').trim();
  }

  if (!constraint) {
    constraint = undefined;
  }

  return {
    name,
    constraint,
  };
}

export function collectActualTypeParameterConstraints(
  entry: SpecExport,
): Map<string, string | undefined> {
  const constraints = new Map<string, string | undefined>();

  for (const typeParam of entry.typeParameters ?? []) {
    if (!typeParam?.name || constraints.has(typeParam.name)) {
      continue;
    }
    constraints.set(typeParam.name, typeParam.constraint ?? undefined);
  }

  for (const signature of entry.signatures ?? []) {
    for (const typeParam of signature.typeParameters ?? []) {
      if (!typeParam?.name || constraints.has(typeParam.name)) {
        continue;
      }
      constraints.set(typeParam.name, typeParam.constraint ?? undefined);
    }
  }

  return constraints;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fuzzy Matching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split a camelCase or PascalCase string into words.
 */
export function splitCamelCase(str: string): string[] {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);
}

/**
 * Find the closest matching candidate using word-based scoring.
 * Returns undefined if no good match is found (score < 0.5).
 */
export function findClosestMatch(source: string, candidates: string[]): ClosestMatch | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  const sourceWords = splitCamelCase(source);
  let bestMatch: string | undefined;
  let bestScore = 0;

  for (const candidate of candidates) {
    // Skip exact matches (not a suggestion if it's the same)
    if (candidate === source) continue;

    const candidateWords = splitCamelCase(candidate);

    // Calculate word overlap
    let matchingWords = 0;
    let suffixMatch = false;

    // Check suffix match (most important for API renames like call→fetchCall)
    if (sourceWords.length > 0 && candidateWords.length > 0) {
      const sourceSuffix = sourceWords[sourceWords.length - 1];
      const candidateSuffix = candidateWords[candidateWords.length - 1];
      if (sourceSuffix === candidateSuffix) {
        suffixMatch = true;
        matchingWords += 1.5; // Weight suffix matches
      }
    }

    // Count other matching words (excluding suffix to avoid double-counting)
    const suffixWord = suffixMatch ? sourceWords[sourceWords.length - 1] : null;
    for (const word of sourceWords) {
      if (word !== suffixWord && candidateWords.includes(word)) {
        matchingWords++;
      }
    }

    // Require meaningful overlap: suffix alone isn't enough
    if (matchingWords < 2) continue;

    // Word score (0 to 1+)
    const wordScore = matchingWords / Math.max(sourceWords.length, candidateWords.length);

    // Normalized Levenshtein distance (0 to 1, higher is better)
    const editDistance = levenshtein(source.toLowerCase(), candidate.toLowerCase());
    const maxLen = Math.max(source.length, candidate.length);
    const levScore = 1 - editDistance / maxLen;

    // Combined score with suffix bonus
    const totalScore = suffixMatch ? wordScore * 1.5 + levScore : wordScore + levScore * 0.5;

    if (totalScore > bestScore && totalScore >= 0.5) {
      bestScore = totalScore;
      bestMatch = candidate;
    }
  }

  if (!bestMatch) {
    return undefined;
  }

  // Convert score to distance (lower is better, for compatibility)
  const distance = Math.round((1 - bestScore) * 10);
  return { value: bestMatch, distance };
}

export function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Builders
// ─────────────────────────────────────────────────────────────────────────────

export function buildReturnTypeMismatchIssue(
  documentedRaw: string,
  documentedNormalized: string,
  declaredNormalized: string,
): string {
  const docPromiseInner = unwrapPromise(documentedNormalized);
  const declaredPromiseInner = unwrapPromise(declaredNormalized);

  if (docPromiseInner && !declaredPromiseInner && docPromiseInner === declaredNormalized) {
    return `JSDoc documents Promise<${docPromiseInner}> but the function returns ${declaredNormalized}.`;
  }

  if (!docPromiseInner && declaredPromiseInner && documentedNormalized === declaredPromiseInner) {
    return `JSDoc documents ${documentedNormalized} but the function returns Promise<${declaredPromiseInner}>.`;
  }

  return `JSDoc documents ${documentedRaw} but the function returns ${declaredNormalized}.`;
}

export function buildParamTypeMismatchIssue(
  paramName: string,
  documentedRaw: string,
  declaredRaw: string,
): string {
  return `JSDoc documents ${documentedRaw} for parameter "${paramName}" but the signature declares ${declaredRaw}.`;
}

export function buildGenericConstraintMismatchIssue(
  templateName: string,
  documentedConstraint?: string,
  actualConstraint?: string,
): string {
  if (actualConstraint && documentedConstraint) {
    return `JSDoc constrains template "${templateName}" to ${documentedConstraint} but the declaration constrains it to ${actualConstraint}.`;
  }

  if (actualConstraint && !documentedConstraint) {
    return `JSDoc omits the constraint for template "${templateName}" but the declaration constrains it to ${actualConstraint}.`;
  }

  if (!actualConstraint && documentedConstraint) {
    return `JSDoc constrains template "${templateName}" to ${documentedConstraint} but the declaration has no constraint.`;
  }

  return `Template "${templateName}" has inconsistent constraints between JSDoc and the declaration.`;
}

export function buildGenericConstraintSuggestion(
  templateName: string,
  actualConstraint?: string,
): string | undefined {
  if (actualConstraint) {
    return `Update @template to {${actualConstraint}} ${templateName} to reflect the declaration.`;
  }

  return `Remove the constraint from @template ${templateName} to match the declaration.`;
}
