import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { ApiSpec } from '@driftdev/sdk/types';
import type { EvaluateFn } from '../src/jev/evaluate';
import { evaluateBatched, loadEvaluate, MAX_JEV_QUESTIONS } from '../src/jev/evaluate';
import { proposeDocsMap } from '../src/jev/propose';
import { type GoldPage, scoreGold } from '../src/jev/score-gold';

const FIXTURE = path.resolve(__dirname, 'fixtures/docs-map-propose');
const PAGE = 'docs/config.mdx';
const CLI = path.resolve(__dirname, '../src/drift.ts');
const GOLD: GoldPage[] = JSON.parse(readFileSync(path.join(FIXTURE, 'gold.json'), 'utf-8')).pages;
const MDX = readFileSync(path.join(FIXTURE, 'docs/config.mdx'), 'utf-8');

const GAPS = GOLD[0].gaps;

function props(keys: string[]): Record<string, { type: string; description?: string }> {
  return Object.fromEntries(keys.map((k) => [k, { type: 'string' }]));
}

const SPEC: ApiSpec = {
  meta: { name: 'fixture' },
  exports: [
    {
      id: 'ClientOptions',
      name: 'ClientOptions',
      kind: 'type',
      schema: {
        type: 'object',
        properties: {
          ...props([
            'host',
            'flushInterval',
            'apiKey',
            'timeout',
            'retry',
            'debug',
            'token',
            ...GAPS.filter((k) => k.startsWith('missing')),
          ]),
          tracingHeaders: { type: 'boolean', description: 'W3C tracing headers' },
          _private: { type: 'string' },
        },
      },
    },
    {
      id: 'OtherOptions',
      name: 'OtherOptions',
      kind: 'type',
      schema: {
        type: 'object',
        properties: props(['host', 'flushInterval', 'apiKey', 'extraFoo']),
      },
    },
    {
      id: 'NetworkOptions',
      name: 'NetworkOptions',
      kind: 'type',
      schema: { type: 'object', properties: props(['host', 'timeout', 'apiKey', 'extraBar']) },
    },
  ],
};

function pageInput(type = 'ClientOptions') {
  return {
    entry: { page: PAGE, type, baselineGaps: 0 },
    files: [{ path: path.join(FIXTURE, PAGE), content: MDX }],
    spec: SPEC,
    candidates: [
      { type: 'ClientOptions', overlap: 4, keys: 19 },
      { type: 'OtherOptions', overlap: 3, keys: 4 },
      { type: 'NetworkOptions', overlap: 3, keys: 4 },
    ],
  };
}

function keyFromInstructions(instructions: string): string | undefined {
  return instructions.match(/key "([^"]+)"/)?.[1];
}

const correctEvaluate: EvaluateFn = async (req) => {
  const answers: Record<string, { type: 'choice'; choice: string; confidence: number }> = {};
  for (const [id, q] of Object.entries(req.questions)) {
    if (id.startsWith('t')) {
      answers[id] = { type: 'choice', choice: 'ClientOptions', confidence: 0.95 };
      continue;
    }
    const key = keyFromInstructions(String(q.instructions));
    let choice = 'gap';
    if (key === 'tracingHeaders') choice = 'prose-documented';
    if (key === 'token') choice = 'internal-by-convention';
    answers[id] = { type: 'choice', choice, confidence: 0.95 };
  }
  return { answers };
};

describe('proposeDocsMap', () => {
  test('correct Jev: surfaces all gold gaps, applies prose + internal, drowns none', async () => {
    const result = await proposeDocsMap({ evaluate: correctEvaluate, pages: [pageInput()] });
    const score = scoreGold(result.pages, GOLD);
    expect(score.goldGaps).toBe(12);
    expect(score.surfaced).toBe(12);
    expect(score.drowned).toBe(0);
    expect(score.typeCorrect).toBe(1);
    expect(score.annotationHits).toBe(2);
    expect(result.pages[0].annotations).toEqual({
      tracingHeaders: 'prose-documented',
      token: 'internal-by-convention',
    });
  });

  test('overeager prose-documented on unmentioned keys is refused (no drown)', async () => {
    const overeager: EvaluateFn = async (req) => ({
      answers: Object.fromEntries(
        Object.keys(req.questions).map((id) => [
          id,
          {
            type: 'choice' as const,
            choice: id.startsWith('t') ? 'ClientOptions' : 'prose-documented',
            confidence: 0.99,
          },
        ]),
      ),
    });
    const result = await proposeDocsMap({ evaluate: overeager, pages: [pageInput()] });
    const score = scoreGold(result.pages, GOLD);
    expect(score.surfaced).toBe(12);
    expect(score.drowned).toBe(0);
    expect(result.pages[0].annotations?.tracingHeaders).toBe('prose-documented');
    for (const key of GAPS) {
      expect(result.pages[0].annotations?.[key]).toBeUndefined();
    }
    expect(result.needsReview.some((r) => r.reason.includes('not mentioned'))).toBe(true);
  });

  test('low confidence lists for human, writes nothing', async () => {
    const shy: EvaluateFn = async (req) => ({
      answers: Object.fromEntries(
        Object.keys(req.questions).map((id) => [
          id,
          {
            type: 'choice' as const,
            choice: id.startsWith('t') ? 'ClientOptions' : 'prose-documented',
            confidence: 0.2,
          },
        ]),
      ),
    });
    const result = await proposeDocsMap({ evaluate: shy, pages: [pageInput('OtherOptions')] });
    expect(result.applied).toEqual([]);
    expect(result.pages[0].type).toBe('OtherOptions');
    expect(result.pages[0].annotations).toBeUndefined();
    expect(result.needsReview.length).toBeGreaterThan(0);
    expect(scoreGold(result.pages, GOLD).drowned).toBe(0);
  });

  test('type confirmation overrides stub pick', async () => {
    const result = await proposeDocsMap({
      evaluate: correctEvaluate,
      pages: [pageInput('OtherOptions')],
    });
    expect(result.pages[0].type).toBe('ClientOptions');
    expect(result.applied.some((a) => a.type === 'ClientOptions')).toBe(true);
  });

  test('ignore is never auto-written', async () => {
    const ignorer: EvaluateFn = async (req) => ({
      answers: Object.fromEntries(
        Object.keys(req.questions).map((id) => [
          id,
          {
            type: 'choice' as const,
            choice: id.startsWith('t') ? 'ClientOptions' : 'ignore',
            confidence: 0.99,
          },
        ]),
      ),
    });
    const result = await proposeDocsMap({ evaluate: ignorer, pages: [pageInput()] });
    expect(result.pages[0].annotations).toBeUndefined();
    expect(result.needsReview.some((r) => r.choice === 'ignore')).toBe(true);
    expect(scoreGold(result.pages, GOLD).drowned).toBe(0);
  });

  test('batches many questions into one call (or a few ≤ MAX)', async () => {
    let calls = 0;
    let maxBatch = 0;
    const spy: EvaluateFn = async (req) => {
      calls++;
      maxBatch = Math.max(maxBatch, Object.keys(req.questions).length);
      return correctEvaluate(req);
    };
    await proposeDocsMap({ evaluate: spy, pages: [pageInput()] });
    expect(calls).toBeGreaterThanOrEqual(1);
    expect(calls).toBeLessThanOrEqual(4);
    expect(maxBatch).toBeLessThanOrEqual(MAX_JEV_QUESTIONS);
    expect(maxBatch).toBeGreaterThan(1);
  });
});

describe('evaluateBatched', () => {
  test('chunks above MAX_JEV_QUESTIONS', async () => {
    const sizes: number[] = [];
    const evaluate: EvaluateFn = async (req) => {
      sizes.push(Object.keys(req.questions).length);
      return {
        answers: Object.fromEntries(
          Object.keys(req.questions).map((id) => [id, { type: 'noul' as const, noul: 0.1 }]),
        ),
      };
    };
    const questions = Object.fromEntries(
      Array.from({ length: MAX_JEV_QUESTIONS + 3 }, (_, i) => [
        `q${i}`,
        { type: 'noul' as const, instructions: `q${i}` },
      ]),
    );
    const result = await evaluateBatched(evaluate, { n: 1 }, questions);
    expect(sizes).toEqual([MAX_JEV_QUESTIONS, 3]);
    expect(Object.keys(result.answers)).toHaveLength(MAX_JEV_QUESTIONS + 3);
  });
});

describe('loadEvaluate', () => {
  test('fails loud without TYPESAFE_API_KEY', async () => {
    const prev = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    try {
      await expect(loadEvaluate()).rejects.toThrow(/TYPESAFE_API_KEY/);
    } finally {
      if (prev !== undefined) process.env.TYPESAFE_API_KEY = prev;
    }
  });
});

describe('drift docs propose (cli)', () => {
  test('exits 2 without TYPESAFE_API_KEY', () => {
    const env = { ...process.env, NO_COLOR: '1' };
    delete env.TYPESAFE_API_KEY;
    const result = Bun.spawnSync(
      ['bun', 'run', CLI, 'docs', 'propose', '--docs', 'docs', '--json'],
      { cwd: FIXTURE, env, stdout: 'pipe', stderr: 'pipe' },
    );
    expect(result.exitCode).toBe(2);
    const out = `${result.stdout.toString()}${result.stderr.toString()}`;
    expect(out).toContain('TYPESAFE_API_KEY');
  });
});
