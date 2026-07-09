/**
 * Local $ref resolution (within-document only, JSON pointer form `#/...`).
 * Remote/file refs are out of scope and left untouched.
 */
import type { OpenApiDocument } from './types';

function isLocalRef(ref: unknown): ref is string {
  return typeof ref === 'string' && ref.startsWith('#/');
}

function unescapePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Resolve a local JSON pointer against the document.
 * Throws on a dangling local ref (malformed document).
 */
export function resolveRef(doc: OpenApiDocument, ref: string): unknown {
  if (!isLocalRef(ref)) {
    throw new Error(`Only local $refs are supported: ${ref}`);
  }
  let node: unknown = doc;
  for (const raw of ref.slice(2).split('/')) {
    const segment = unescapePointerSegment(raw);
    if (node === null || typeof node !== 'object') {
      throw new Error(`Unresolvable $ref: ${ref}`);
    }
    node = (node as Record<string, unknown>)[segment];
  }
  if (node === undefined) {
    throw new Error(`Unresolvable $ref: ${ref}`);
  }
  return node;
}

/**
 * Deep-resolve every local $ref in a node, returning a new structure.
 *
 * - 3.1 sibling keys alongside $ref are merged over the resolved target.
 * - Cycles are broken by leaving the inner `{ $ref }` in place.
 * - Non-local refs pass through untouched.
 */
export function deepResolve(
  doc: OpenApiDocument,
  node: unknown,
  seen: Set<string> = new Set(),
): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => deepResolve(doc, item, seen));
  }
  if (node === null || typeof node !== 'object') {
    return node;
  }

  const obj = node as Record<string, unknown>;
  const ref = obj.$ref;

  if (isLocalRef(ref)) {
    if (seen.has(ref)) {
      return { $ref: ref };
    }
    const target = resolveRef(doc, ref);
    const nextSeen = new Set(seen);
    nextSeen.add(ref);
    const resolved = deepResolve(doc, target, nextSeen);
    const siblings: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key !== '$ref') siblings[key] = deepResolve(doc, value, nextSeen);
    }
    if (Object.keys(siblings).length === 0) {
      return resolved;
    }
    if (resolved === null || typeof resolved !== 'object' || Array.isArray(resolved)) {
      return siblings;
    }
    return { ...(resolved as Record<string, unknown>), ...siblings };
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = deepResolve(doc, value, seen);
  }
  return out;
}
