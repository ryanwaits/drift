/**
 * Key set-diff: spec type properties vs documented keys.
 *
 * Ghost resolution runs against ALL spec types, not just the mapped one —
 * sub-config tables (e.g. AutocaptureConfig keys on the same page) legitimately
 * document other types' keys; a naive per-type check produces false ghosts.
 */

import type { ApiExport, ApiSpec, ApiType } from '../api-spec';
import type {
  DocsKeyCorpus,
  KeyCoverageOptions,
  KeyCoverageResult,
  KeyGap,
  KeyInversion,
  KeyMeta,
} from './types';

type SpecEntry = ApiExport | ApiType;

/** Find a type-like entry by name: exports first, then referenced types. */
export function findTypeEntry(spec: ApiSpec, name: string): SpecEntry | undefined {
  return spec.exports?.find((e) => e.name === name) ?? spec.types?.find((t) => t.name === name);
}

/**
 * Collect property keys + metadata from a spec entry.
 * Walks schema objects (including allOf members) and the members array.
 */
export function collectTypeKeys(entry: SpecEntry): Map<string, KeyMeta> {
  const keys = new Map<string, KeyMeta>();

  const addProps = (schema: unknown): void => {
    if (typeof schema !== 'object' || schema === null) return;
    const s = schema as Record<string, unknown>;
    if (Array.isArray(s.allOf)) for (const m of s.allOf) addProps(m);
    if (Array.isArray(s.anyOf)) for (const m of s.anyOf) addProps(m);
    if (typeof s.properties === 'object' && s.properties !== null) {
      for (const [name, value] of Object.entries(s.properties as Record<string, unknown>)) {
        const v = (typeof value === 'object' && value !== null ? value : {}) as Record<
          string,
          unknown
        >;
        const existing = keys.get(name) ?? {};
        keys.set(name, {
          description: (v.description as string | undefined) ?? existing.description,
          deprecated: (v.deprecated as boolean | undefined) ?? existing.deprecated,
          deprecationReason:
            (v['x-deprecated-reason'] as string | undefined) ??
            (v.deprecationReason as string | undefined) ??
            existing.deprecationReason,
        });
      }
    }
  };

  addProps(entry.schema);
  addProps(entry.type);
  for (const member of entry.members ?? []) {
    if (!member.name) continue;
    const existing = keys.get(member.name) ?? {};
    keys.set(member.name, {
      description: member.description ?? existing.description,
      deprecated: member.deprecated ?? existing.deprecated,
      deprecationReason: member.deprecationReason ?? existing.deprecationReason,
    });
  }

  return keys;
}

/** Union of property keys across every entry in the spec (ghost resolution). */
export function collectAllTypeKeys(spec: ApiSpec): Set<string> {
  const all = new Set<string>();
  for (const entry of [...(spec.exports ?? []), ...(spec.types ?? [])]) {
    for (const key of collectTypeKeys(entry).keys()) all.add(key);
  }
  return all;
}

/** Parse a replacement key out of a deprecation reason: "Use `secretKey` instead." */
export function parseReplacement(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  const m = reason.match(/use\s+`?([A-Za-z_$][\w$]*)`?\s+instead/i);
  return m?.[1];
}

/**
 * Diff a spec type's keys against the documented-key corpus.
 * Returns null if the type is not found in the spec (caller decides severity).
 */
export function computeKeyCoverage(
  spec: ApiSpec,
  typeName: string,
  corpus: DocsKeyCorpus,
  options: KeyCoverageOptions = {},
): KeyCoverageResult | null {
  // A spec can carry several entries with the same name (an export plus a
  // referenced-types variant, flattened to different depths). Merge their
  // keys — the fullest view of the type is the truthful one.
  const entries = [...(spec.exports ?? []), ...(spec.types ?? [])].filter(
    (e) => e.name === typeName,
  );
  if (entries.length === 0) return null;

  const keyMeta = new Map<string, KeyMeta>();
  for (const entry of entries) {
    for (const [key, meta] of collectTypeKeys(entry)) {
      const existing = keyMeta.get(key) ?? {};
      keyMeta.set(key, {
        description: existing.description ?? meta.description,
        deprecated: existing.deprecated ?? meta.deprecated,
        deprecationReason: existing.deprecationReason ?? meta.deprecationReason,
      });
    }
  }
  const codeKeys = [...keyMeta.keys()];
  const codeSet = new Set(codeKeys);
  const allTypeKeys = collectAllTypeKeys(spec);

  const annotations = options.annotations ?? {};
  const deprecatedOverride = new Set(options.deprecated ?? []);
  const internalExtra = new Set(options.internal ?? []);

  const isDeprecated = (k: string): boolean =>
    keyMeta.get(k)?.deprecated === true || deprecatedOverride.has(k);
  const isInternal = (k: string): boolean =>
    k.startsWith('_') || internalExtra.has(k) || annotations[k] === 'internal-by-convention';
  const isIgnored = (k: string): boolean => annotations[k] === 'ignore';
  const isProseDocumented = (k: string): boolean => annotations[k] === 'prose-documented';
  const replacementFor = (k: string): { key: string; source: 'spec' | 'map' } | undefined => {
    const fromMap = options.replacements?.[k];
    if (fromMap) return { key: fromMap, source: 'map' };
    const fromSpec = parseReplacement(keyMeta.get(k)?.deprecationReason);
    return fromSpec ? { key: fromSpec, source: 'spec' } : undefined;
  };
  const mentioned = (k: string): boolean =>
    corpus.inlineMentions.has(k) || corpus.text.includes(`${k}:`);

  const documentedSet = new Set(corpus.documented.keys());

  // Ghosts: documented keys absent from EVERY spec type
  const ghostCandidates = [...documentedSet].filter((k) => !codeSet.has(k));
  const ghosts = ghostCandidates
    .filter((k) => !allTypeKeys.has(k))
    .sort()
    .map((key) => ({ key, locations: corpus.documented.get(key) ?? [] }));
  const documentedKeysFromOtherTypes = ghostCandidates.filter((k) => allTypeKeys.has(k)).sort();

  // Gaps: code keys not documented, minus ignored/annotated
  const gapsAll = codeKeys.filter((k) => !documentedSet.has(k) && !isIgnored(k));
  const proseDocumented = gapsAll.filter(isProseDocumented).sort();
  const internal = gapsAll.filter((k) => !isProseDocumented(k) && isInternal(k)).sort();
  const deprecated = gapsAll
    .filter((k) => !isProseDocumented(k) && !isInternal(k) && isDeprecated(k))
    .sort();
  const userFacing: KeyGap[] = gapsAll
    .filter((k) => !isProseDocumented(k) && !isInternal(k) && !isDeprecated(k))
    .sort()
    .map((key) => ({
      key,
      ...(keyMeta.get(key)?.description ? { description: keyMeta.get(key)?.description } : {}),
      mentioned: mentioned(key),
    }));

  // Inversions: documented deprecated key whose replacement is NOT documented
  const inversions: KeyInversion[] = [...documentedSet]
    .filter((k) => codeSet.has(k) && isDeprecated(k))
    .map((k) => ({ k, repl: replacementFor(k) }))
    .filter(
      (x): x is { k: string; repl: { key: string; source: 'spec' | 'map' } } =>
        x.repl !== undefined && !documentedSet.has(x.repl.key),
    )
    .map(({ k, repl }) => ({ documented: k, replacement: repl.key, source: repl.source }))
    .sort((a, b) => a.documented.localeCompare(b.documented));

  const codePublic = codeKeys.filter((k) => !isInternal(k) && !isDeprecated(k) && !isIgnored(k));

  return {
    type: typeName,
    counts: {
      code: codeKeys.length,
      codePublic: codePublic.length,
      documented: documentedSet.size,
      gapsUserFacing: userFacing.length,
      ghosts: ghosts.length,
      inversions: inversions.length,
    },
    documented: [...documentedSet].sort(),
    gaps: { userFacing, internal, deprecated },
    ghosts,
    documentedKeysFromOtherTypes,
    inversions,
    annotated: {
      proseDocumented,
      ignored: codeKeys.filter(isIgnored).sort(),
    },
  };
}
