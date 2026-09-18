/**
 * Deterministic docs-file ranking: pages with option tables × spec types
 * by key overlap. Shared by `drift docs init` and `propose`.
 */

import * as path from 'node:path';
import { collectTypeKeys, DEFAULT_SECTION_RE, extractDocumentedKeys } from '@driftdev/sdk';
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
  /** Set when the matched tables sit under headings the default section regex misses. */
  sectionRe?: string;
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

/**
 * Ranking matches every heading; scan only opens DEFAULT_SECTION_RE sections.
 * When the winning type's keys sit under other headings, name those headings
 * so the stub reproduces under scan instead of reporting 0 documented keys.
 */
function stubSectionRe(
  documented: Map<string, Array<{ section: string }>>,
  typeKeys: Set<string>,
): string | undefined {
  const sections = new Set<string>();
  for (const [key, locs] of documented) {
    if (!typeKeys.has(key)) continue;
    for (const loc of locs) sections.add(loc.section);
  }
  if ([...sections].every((s) => DEFAULT_SECTION_RE.test(s))) return undefined;
  return [...sections].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
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
    const sectionRe = stubSectionRe(extraction.documented, types.get(ranked[0].type) ?? new Set());
    pages.push({
      page: path.relative(cwd, file.path),
      keys: pageKeys.size,
      type: ranked[0].type,
      ...(sectionRe ? { sectionRe } : {}),
      candidates: ranked,
    });
  }
  return pages;
}
