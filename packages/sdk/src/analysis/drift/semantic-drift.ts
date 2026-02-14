import type { ApiExport, ApiTag } from '../api-spec';
import type { ModuleGraph } from '../module-graph';
import type {
  CodeVisibility,
  DocVisibility,
  DocVisibilitySignal,
  ExportRegistry,
  SpecDocDrift,
  SpecMemberWithVisibility,
} from './types';
import { extractTypeFromSchema, findClosestMatch } from './utils';

/**
 * Options for broken link detection.
 */
export interface BrokenLinkOptions {
  /**
   * Module graph for cross-module symbol validation.
   * When provided, @link targets are validated across all modules.
   */
  moduleGraph?: ModuleGraph;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deprecated Drift
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect mismatches between @deprecated tag and actual deprecation status.
 */
export function detectDeprecatedDrift(entry: ApiExport): SpecDocDrift[] {
  const codeDeprecated = Boolean(entry.deprecated);
  const docsDeprecated =
    entry.tags?.some((tag) => tag.name.toLowerCase() === 'deprecated') ?? false;

  if (codeDeprecated === docsDeprecated) {
    return [];
  }

  const target = entry.name ?? entry.id;

  if (codeDeprecated && !docsDeprecated) {
    return [
      {
        type: 'deprecated-mismatch',
        target,
        issue: `Declaration for "${target}" is marked deprecated but @deprecated is missing from the docs.`,
        expected: 'not deprecated',
        actual: 'deprecated',
        suggestion: 'Add an @deprecated tag explaining the replacement or removal timeline.',
      },
    ];
  }

  return [
    {
      type: 'deprecated-mismatch',
      target,
      issue: `JSDoc marks "${target}" as deprecated but the TypeScript declaration is not.`,
      expected: '@deprecated',
      actual: 'not deprecated',
      suggestion: 'Remove the @deprecated tag or deprecate the declaration.',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Visibility Drift
// ─────────────────────────────────────────────────────────────────────────────

const VISIBILITY_TAG_MAP: Record<string, DocVisibility> = {
  internal: 'internal',
  alpha: 'internal',
  private: 'private',
  protected: 'protected',
  public: 'public',
};

/**
 * Detect mismatches between visibility JSDoc tags and actual visibility.
 */
export function detectVisibilityDrift(entry: ApiExport): SpecDocDrift[] {
  const drifts: SpecDocDrift[] = [];
  const exportDocVisibility = getDocVisibility(entry.tags);
  const exportActualVisibility: CodeVisibility = 'public';

  if (
    exportDocVisibility &&
    !visibilityMatches(exportDocVisibility.value, exportActualVisibility)
  ) {
    const target = entry.name ?? entry.id ?? 'export';
    drifts.push({
      type: 'visibility-mismatch',
      target,
      issue: buildVisibilityIssue(target, exportDocVisibility, exportActualVisibility),
      expected: formatDocVisibilityTag(exportDocVisibility.tagName),
      actual: exportActualVisibility,
      suggestion: buildVisibilitySuggestion(exportDocVisibility, exportActualVisibility),
    });
  }

  const members = Array.isArray(entry.members) ? entry.members : [];
  for (const member of members) {
    const typedMember = member as SpecMemberWithVisibility;
    const memberDocVisibility = getDocVisibility(typedMember.tags);
    if (!memberDocVisibility) {
      continue;
    }

    const memberActualVisibility: CodeVisibility = typedMember.visibility ?? 'public';
    if (visibilityMatches(memberDocVisibility.value, memberActualVisibility)) {
      continue;
    }

    const memberName = typedMember.name ?? typedMember.id ?? typedMember.kind ?? 'member';
    const qualifiedTarget = `${entry.name ?? entry.id ?? 'export'}#${memberName}`;

    drifts.push({
      type: 'visibility-mismatch',
      target: qualifiedTarget,
      issue: buildVisibilityIssue(qualifiedTarget, memberDocVisibility, memberActualVisibility),
      expected: formatDocVisibilityTag(memberDocVisibility.tagName),
      actual: memberActualVisibility,
      suggestion: buildVisibilitySuggestion(memberDocVisibility, memberActualVisibility),
    });
  }

  return drifts;
}

function getDocVisibility(tags?: ApiTag[]): DocVisibilitySignal | undefined {
  if (!tags) {
    return undefined;
  }

  for (const tag of tags) {
    const normalizedName = tag.name?.toLowerCase();
    if (!normalizedName) {
      continue;
    }

    const mapped = VISIBILITY_TAG_MAP[normalizedName];
    if (mapped) {
      return {
        value: mapped,
        tagName: tag.name,
      };
    }
  }

  return undefined;
}

function visibilityMatches(
  docVisibility: DocVisibility,
  actualVisibility: CodeVisibility,
): boolean {
  if (docVisibility === 'internal') {
    return actualVisibility !== 'public';
  }

  if (docVisibility === 'public') {
    return actualVisibility === 'public';
  }

  return docVisibility === actualVisibility;
}

function buildVisibilityIssue(
  target: string,
  docVisibility: DocVisibilitySignal,
  actualVisibility: CodeVisibility,
): string {
  const docLabel = formatDocVisibilityTag(docVisibility.tagName);
  return `JSDoc marks "${target}" as ${docLabel} but the declaration is ${actualVisibility}.`;
}

function buildVisibilitySuggestion(
  docVisibility: DocVisibilitySignal,
  actualVisibility: CodeVisibility,
): string {
  const docLabel = formatDocVisibilityTag(docVisibility.tagName);

  switch (docVisibility.value) {
    case 'internal':
      return `Remove ${docLabel} or mark the declaration protected/private.`;
    case 'public':
      return `Remove ${docLabel} or mark the declaration public.`;
    case 'protected':
      if (actualVisibility === 'private') {
        return `Promote the declaration to protected or replace ${docLabel} with @private.`;
      }
      return `Remove ${docLabel} or mark the declaration protected.`;
    case 'private':
      if (actualVisibility === 'protected') {
        return `Downgrade the declaration to private or replace ${docLabel} with @protected/@internal.`;
      }
      return `Remove ${docLabel} or mark the declaration private.`;
    default:
      return 'Align the JSDoc visibility tag with the declaration visibility.';
  }
}

function formatDocVisibilityTag(tagName: string): string {
  const trimmed = tagName.trim();
  if (!trimmed) {
    return '@internal';
  }

  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Broken Links
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect broken {@link}, {@see}, {@inheritDoc} references.
 *
 * When a moduleGraph is provided, validates references across all modules
 * in the graph before reporting as broken.
 *
 * @param entry - Export to check for broken links
 * @param registry - Registry of exports/types in current module
 * @param options - Optional config including moduleGraph for cross-module validation
 */
export function detectBrokenLinks(
  entry: ApiExport,
  registry?: ExportRegistry,
  options?: BrokenLinkOptions,
): SpecDocDrift[] {
  if (!registry) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];
  const { moduleGraph } = options ?? {};

  // Patterns for various link/reference syntaxes in TSDoc/JSDoc
  const patterns: Array<{ pattern: RegExp; type: string }> = [
    // TSDoc: {@link Target}, {@link Target | label}
    { pattern: /\{@link\s+([^}\s|]+)(?:\s*\|[^}]*)?\}/g, type: '@link' },
    // TSDoc: {@see Target}
    { pattern: /\{@see\s+([^}\s]+)\}/g, type: '@see' },
    // TSDoc: {@inheritDoc Target}
    { pattern: /\{@inheritDoc\s+([^}\s]+)\}/g, type: '@inheritDoc' },
  ];

  // Collect all text that might contain links
  // Skip code blocks to avoid false positives
  const allText = [
    entry.description ?? '',
    ...(entry.tags ?? [])
      .filter((tag) => tag.name !== 'example') // examples checked separately
      .map((tag) => tag.text),
  ].join(' ');

  // Remove code blocks from text to avoid false positives
  const textWithoutCode = allText
    .replace(/```[\s\S]*?```/g, '') // fenced code blocks
    .replace(/`[^`]+`/g, ''); // inline code

  for (const { pattern, type } of patterns) {
    const matches = textWithoutCode.matchAll(pattern);

    for (const match of matches) {
      const target = match[1];
      if (!target) continue;

      // Skip URLs
      if (target.startsWith('http://') || target.startsWith('https://')) {
        continue;
      }

      // Handle qualified names (e.g., "Foo.bar" -> check "Foo")
      const rootName = target.split('.')[0] ?? target;

      // Skip external references (module specifiers)
      if (target.includes('/') || target.includes('@')) {
        continue;
      }

      // Check current module first
      if (registry.all.has(rootName) || registry.all.has(target)) {
        continue;
      }

      // Check cross-module if graph available
      if (moduleGraph?.all.has(rootName) || moduleGraph?.all.has(target)) {
        continue;
      }

      // Symbol not found anywhere - report as broken
      // For links, suggest from all exports and types (use pre-computed array)
      const suggestion = findClosestMatch(rootName, registry.allNames);

      drifts.push({
        type: 'broken-link',
        target,
        issue: `{${type} ${target}} references a symbol that does not exist.`,
        expected: target,
        actual: suggestion?.value,
        suggestion: suggestion ? `Did you mean "${suggestion.value}"?` : undefined,
      });
    }
  }

  return drifts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Async Mismatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect mismatches between async documentation and actual async behavior.
 */
export function detectAsyncMismatch(entry: ApiExport): SpecDocDrift[] {
  const signatures = entry.signatures ?? [];
  if (signatures.length === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  // Check if any signature returns a Promise
  const returnsPromise = signatures.some((sig) => {
    const returnType = extractTypeFromSchema(sig.returns?.schema) ?? '';
    return returnType.startsWith('Promise<') || returnType === 'Promise';
  });

  // Check if @returns documents Promise
  const returnsTag = entry.tags?.find((tag) => tag.name === 'returns' || tag.name === 'return');
  const documentedAsPromise = returnsTag?.text?.includes('Promise') ?? false;

  // Check if @async tag is present
  const hasAsyncTag = entry.tags?.some((tag) => tag.name === 'async');

  // Check flags for async
  const isAsyncFunction = (entry as { flags?: { async?: boolean } }).flags?.async === true;

  // Case 1: Returns Promise but not documented as async/Promise
  if (returnsPromise && !documentedAsPromise && !hasAsyncTag) {
    drifts.push({
      type: 'async-mismatch',
      target: 'returns',
      issue: 'Function returns Promise but documentation does not indicate async behavior.',
      expected: 'sync',
      actual: 'Promise',
      suggestion: 'Add @async tag or document @returns {Promise<...>}.',
    });
  }

  // Case 2: Documented as async but doesn't return Promise
  if (!returnsPromise && (documentedAsPromise || hasAsyncTag) && !isAsyncFunction) {
    drifts.push({
      type: 'async-mismatch',
      target: 'returns',
      issue: 'Documentation indicates async but function does not return Promise.',
      expected: '@async / Promise',
      actual: 'sync',
      suggestion: 'Remove @async tag or update @returns type.',
    });
  }

  return drifts;
}
