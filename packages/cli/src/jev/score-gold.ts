/**
 * Score a proposed docs map against gold labels.
 * Eval gate: surface real gaps; do not drown them in prose-documented/ignore.
 */

import type { DocsMapAnnotation, DocsMapPage } from '../config/docs-map';

export interface GoldPage {
  page: string;
  type: string;
  /** Keys that must remain unannotated user-facing gaps. */
  gaps: string[];
  annotations?: Record<string, DocsMapAnnotation>;
}

export interface GoldScore {
  goldGaps: number;
  surfaced: number;
  drowned: number;
  drownedKeys: string[];
  typeCorrect: number;
  typeTotal: number;
  annotationHits: number;
  annotationTotal: number;
}

export function scoreGold(pages: DocsMapPage[], gold: GoldPage[]): GoldScore {
  const byPage = new Map(pages.map((p) => [p.page, p]));
  let goldGaps = 0;
  let surfaced = 0;
  let drowned = 0;
  const drownedKeys: string[] = [];
  let typeCorrect = 0;
  let annotationHits = 0;
  let annotationTotal = 0;

  for (const g of gold) {
    const proposed = byPage.get(g.page);
    if (proposed?.type === g.type) typeCorrect++;
    const annotations = proposed?.annotations ?? {};
    for (const key of g.gaps) {
      goldGaps++;
      if (annotations[key]) {
        drowned++;
        drownedKeys.push(`${g.page}:${key}=${annotations[key]}`);
      } else {
        surfaced++;
      }
    }
    for (const [key, want] of Object.entries(g.annotations ?? {})) {
      annotationTotal++;
      if (annotations[key] === want) annotationHits++;
    }
  }

  return {
    goldGaps,
    surfaced,
    drowned,
    drownedKeys,
    typeCorrect,
    typeTotal: gold.length,
    annotationHits,
    annotationTotal,
  };
}
