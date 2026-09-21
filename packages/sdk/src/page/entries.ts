import type { ApiSignature, ApiSpec } from '../analysis/api-spec';
import type { ExportRegistry } from '../analysis/drift/types';
import { extractFenceImports } from './fences';

/**
 * One entry of a package a page may be written against: the primary spec, or a
 * secondary entry of the same package (`zod/mini` beside `zod`).
 */
export type SpecEntry = {
  spec?: ApiSpec;
  registry: ExportRegistry;
  /** Module specifier whose fence imports select this entry */
  importSpecifier?: string;
};

/**
 * Entry a fence is written against, as an index into `[primary, ...secondaries]`.
 * An import of the primary specifier wins; else the first secondary whose
 * `importSpecifier` the fence imports; else the primary, with `imported: false`
 * (the fence does not say which entry it means).
 */
export function fenceEntry(
  code: string,
  primarySpecifier: string,
  secondaries: ReadonlyArray<{ importSpecifier?: string }>,
): { index: number; imported: boolean } {
  if (secondaries.length === 0) return { index: 0, imported: true };
  const from = new Set(extractFenceImports(code).map((i) => i.from));
  if (from.has(primarySpecifier)) return { index: 0, imported: true };
  const at = secondaries.findIndex((s) => s.importSpecifier && from.has(s.importSpecifier));
  return at === -1 ? { index: 0, imported: false } : { index: at + 1, imported: true };
}

function signatureKey(signatures: ApiSignature[] | undefined): unknown {
  return (signatures ?? []).map((sig) => ({
    parameters: (sig.parameters ?? []).map((p) => [p.name, p.required, p.rest, p.schema]),
    returns: sig.returns?.schema,
  }));
}

function exportKey(spec: ApiSpec, name: string): string | undefined {
  const entry = spec.exports.find((e) => e.name === name);
  if (!entry) return undefined;
  const schema = entry.schema;
  const extra =
    schema && typeof schema === 'object'
      ? (schema as Record<string, unknown>)['x-ts-signatures']
      : undefined;
  return JSON.stringify({
    kind: entry.kind,
    signatures: signatureKey(
      entry.signatures?.length ? entry.signatures : (extra as ApiSignature[] | undefined),
    ),
    members: (entry.members ?? []).map((m) => [m.name, signatureKey(m.signatures)]),
  });
}

/**
 * Export names two or more entries have with different signatures (parameters,
 * return type, members). A fence that imports none of the entries does not say
 * which one it means, so nothing is judged through such a name. An entry
 * without a `spec` cannot be compared: every name it shares is ambiguous.
 */
export function ambiguousExports(entries: readonly SpecEntry[]): Set<string> {
  const ambiguous = new Set<string>();
  const seen = new Map<string, string | undefined>();
  for (const entry of entries) {
    for (const name of entry.registry.exports.keys()) {
      const key = entry.spec ? exportKey(entry.spec, name) : undefined;
      if (!seen.has(name)) seen.set(name, key);
      else if (key === undefined || seen.get(name) !== key) ambiguous.add(name);
    }
  }
  return ambiguous;
}
