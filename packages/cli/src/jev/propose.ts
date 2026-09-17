/**
 * Docs-map propose engine: Jev confirms page→type and triages gap annotations.
 * Writes a proposed map; never commits; never called from scan/ci.
 */

import {
  computeKeyCoverage,
  DEFAULT_SECTION_RE,
  extractDocumentedKeys,
  type KeyAnnotation,
} from '@driftdev/sdk';
import type { ApiSpec } from '@driftdev/sdk/types';
import type { DocsMapAnnotation, DocsMapPage } from '../config/docs-map';
import { type RankedType, rankPageTypes, typeKeySets } from '../utils/docs-map-stub';
import {
  choiceConfidence,
  DEFAULT_CONFIDENCE,
  type EvaluateFn,
  type EvaluateQuestion,
  evaluateBatched,
} from './evaluate';
import { keyQuestion, snippetAround, TYPE_NONE, typeQuestion } from './questions';

export interface ProposePageInput {
  entry: DocsMapPage;
  files: Array<{ path: string; content: string }>;
  spec: ApiSpec;
  candidates: RankedType[];
}

export interface ProposeNeedsReview {
  page: string;
  kind: 'type' | 'key';
  target: string;
  choice?: string;
  confidence: number;
  reason: string;
}

export interface ProposeApplied {
  page: string;
  type?: string;
  key?: string;
  annotation?: DocsMapAnnotation;
  confidence: number;
}

export interface ProposeResult {
  pages: DocsMapPage[];
  needsReview: ProposeNeedsReview[];
  applied: ProposeApplied[];
}

export interface ProposeOptions {
  evaluate: EvaluateFn;
  pages: ProposePageInput[];
  confidence?: number;
}

function pageKeys(files: Array<{ path: string; content: string }>): Set<string> {
  return new Set(extractDocumentedKeys(files, /(?:)/).documented.keys());
}

function fillCandidates(input: ProposePageInput): RankedType[] {
  if (input.candidates.length > 0) return input.candidates;
  return rankPageTypes(pageKeys(input.files), typeKeySets(input.spec));
}

export async function proposeDocsMap(opts: ProposeOptions): Promise<ProposeResult> {
  const threshold = opts.confidence ?? DEFAULT_CONFIDENCE;
  const pages = opts.pages.map((p) => ({
    ...p,
    entry: { ...p.entry, annotations: { ...p.entry.annotations } },
    candidates: fillCandidates(p),
  }));
  const needsReview: ProposeNeedsReview[] = [];
  const applied: ProposeApplied[] = [];

  // ── 1. page→type confirmation ──────────────────────────────────────────
  const typeQuestions: Record<string, EvaluateQuestion> = {};
  const typeState = {
    task: 'Confirm which spec type each docs page documents. Overlap ranking is mechanical; pick the type the page actually describes.',
    pages: pages.map((p, i) => ({
      id: `t${i}`,
      page: p.entry.page,
      current: p.entry.type,
      excerpt: p.files
        .map((f) => f.content)
        .join('\n')
        .slice(0, 2000),
      candidates: p.candidates,
    })),
  };
  for (const [i, p] of pages.entries()) {
    const q = typeQuestion(p.entry.page, p.candidates, p.entry.type);
    if (Object.keys(q.criteria).length < 2) continue;
    typeQuestions[`t${i}`] = q;
  }
  const typeAnswers = await evaluateBatched(opts.evaluate, typeState, typeQuestions);
  for (const [i, p] of pages.entries()) {
    const id = `t${i}`;
    const answer = typeAnswers.answers[id];
    if (!answer) continue;
    const choice = answer.choice;
    const conf = choiceConfidence(answer, choice ?? '');
    const valid =
      choice &&
      choice !== TYPE_NONE &&
      (p.candidates.some((c) => c.type === choice) || p.entry.type === choice);
    if (valid && conf >= threshold) {
      if (p.entry.type !== choice) {
        p.entry.type = choice;
        applied.push({ page: p.entry.page, type: choice, confidence: conf });
      }
    } else {
      needsReview.push({
        page: p.entry.page,
        kind: 'type',
        target: p.entry.page,
        choice,
        confidence: conf,
        reason:
          choice === TYPE_NONE || !valid
            ? 'type pick was none/unknown — kept stub type'
            : `confidence ${conf.toFixed(2)} < ${threshold}`,
      });
    }
  }

  // ── 2. key-annotation triage ───────────────────────────────────────────
  const keyMeta: Array<{
    id: string;
    page: ProposePageInput;
    key: string;
    mentioned: boolean;
  }> = [];
  const keyQuestions: Record<string, EvaluateQuestion> = {};
  const keyStateKeys: Array<Record<string, unknown>> = [];

  for (const [i, p] of pages.entries()) {
    const corpus = extractDocumentedKeys(
      p.files,
      p.entry.sectionRe ? new RegExp(p.entry.sectionRe, 'i') : DEFAULT_SECTION_RE,
    );
    const coverage = computeKeyCoverage(p.spec, p.entry.type, corpus, {
      internal: p.entry.internal,
      deprecated: p.entry.deprecated,
      replacements: p.entry.replacements,
      annotations: p.entry.annotations,
    });
    if (!coverage) {
      needsReview.push({
        page: p.entry.page,
        kind: 'type',
        target: p.entry.type,
        confidence: 0,
        reason: `type "${p.entry.type}" not found in spec`,
      });
      continue;
    }
    const text = p.files.map((f) => f.content).join('\n');
    for (const [j, gap] of coverage.gaps.userFacing.entries()) {
      if (p.entry.annotations?.[gap.key]) continue;
      const id = `k${i}_${j}`;
      keyMeta.push({ id, page: p, key: gap.key, mentioned: gap.mentioned });
      keyQuestions[id] = keyQuestion({
        page: p.entry.page,
        type: p.entry.type,
        key: gap.key,
        description: gap.description,
        mentioned: gap.mentioned,
      });
      keyStateKeys.push({
        id,
        page: p.entry.page,
        type: p.entry.type,
        key: gap.key,
        description: gap.description ?? null,
        mentioned: gap.mentioned,
        snippet: snippetAround(text, gap.key) ?? null,
      });
    }
  }

  const keyAnswers = await evaluateBatched(
    opts.evaluate,
    {
      task: 'Classify undocumented option keys. Prefer gap. Do not mark real public options as prose-documented or ignore.',
      keys: keyStateKeys,
    },
    keyQuestions,
  );

  for (const item of keyMeta) {
    const answer = keyAnswers.answers[item.id];
    const choice = answer?.choice;
    const conf = choiceConfidence(answer, choice ?? '');
    const page = item.page.entry.page;

    if (!choice || choice === 'gap') {
      if (choice && conf < threshold) {
        needsReview.push({
          page,
          kind: 'key',
          target: item.key,
          choice,
          confidence: conf,
          reason: `confidence ${conf.toFixed(2)} < ${threshold}`,
        });
      }
      continue;
    }

    if (conf < threshold) {
      needsReview.push({
        page,
        kind: 'key',
        target: item.key,
        choice,
        confidence: conf,
        reason: `confidence ${conf.toFixed(2)} < ${threshold}`,
      });
      continue;
    }

    if (choice === 'ignore') {
      needsReview.push({
        page,
        kind: 'key',
        target: item.key,
        choice,
        confidence: conf,
        reason: 'ignore requires a human-committed reason — not auto-written',
      });
      continue;
    }

    if (choice === 'prose-documented' && !item.mentioned) {
      needsReview.push({
        page,
        kind: 'key',
        target: item.key,
        choice,
        confidence: conf,
        reason:
          'prose-documented refused: key is not mentioned on the page (would hide a real gap)',
      });
      continue;
    }

    if (choice !== 'prose-documented' && choice !== 'internal-by-convention') {
      needsReview.push({
        page,
        kind: 'key',
        target: item.key,
        choice,
        confidence: conf,
        reason: `unknown choice "${choice}"`,
      });
      continue;
    }

    const annotation = choice as KeyAnnotation;
    item.page.entry.annotations = { ...item.page.entry.annotations, [item.key]: annotation };
    applied.push({ page, key: item.key, annotation, confidence: conf });
  }

  return {
    pages: pages.map((p) => {
      const { annotations, ...rest } = p.entry;
      if (!annotations || Object.keys(annotations).length === 0) return rest;
      return { ...rest, annotations };
    }),
    needsReview,
    applied,
  };
}
