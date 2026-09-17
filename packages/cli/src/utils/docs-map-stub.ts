/**
 * Deterministic docs-file ranking: pages with option tables × spec types
 * by key overlap. Shared by `drift docs init` and `propose`.
 */

import * as path from 'node:path';
import { collectTypeKeys, extractDocumentedKeys } from '@driftdev/sdk';
import type { ApiSpec } from '@driftdev/sdk/types';

export const DOCS_MAP_SCHEMA = 'https://unpkg.com/@driftdev/cli/schemas/drift.docs.schema.json';
export const MATCH_ALL = /(?:)/;
export const MIN_PAGE_KEYS = 3;
export const MIN_OVERLAP = 3;

export interface RankedType {
  type: string;
  overlap: number;
  keys: number;
}

export interface StubCandidate {
  page: string;
  keys: number;
  type: string;
  candidates: RankedType[];
}

export function typeKeySets(spec: ApiSpec): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const entry of [...(spec.exports ?? []), ...(spec.types ?? [])]) {
    const keys = new Set(collectTypeKeys(entry).keys());
    if (keys.size >= MIN_OVERLAP && !out.has(entry.name)) out.set(entry.name, keys);
  }
  return out;
}

export function rankPageTypes(
  pageKeys: Set<string>,
  types: Map<string, Set<string>>,
): RankedType[] {
  return [...types.entries()]
    .map(([name, keys]) => ({
      type: name,
      overlap: [...pageKeys].filter((k) => keys.has(k)).length,
      keys: keys.size,
    }))
    .filter((c) => c.overlap >= MIN_OVERLAP)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3);
}

export function collectStubCandidates(
  corpus: Array<{ path: string; content?: string }>,
  types: Map<string, Set<string>>,
  cwd: string,
): StubCandidate[] {
  const pages: StubCandidate[] = [];
  for (const file of corpus) {
    const extraction = extractDocumentedKeys(
      [{ path: file.path, content: file.content ?? '' }],
      MATCH_ALL,
    );
    const pageKeys = new Set(extraction.documented.keys());
    if (pageKeys.size < MIN_PAGE_KEYS) continue;
    const ranked = rankPageTypes(pageKeys, types);
    if (ranked.length === 0) continue;
    pages.push({
      page: path.relative(cwd, file.path),
      keys: pageKeys.size,
      type: ranked[0].type,
      candidates: ranked,
    });
  }
  return pages;
}
