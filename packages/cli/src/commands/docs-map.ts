/**
 * `drift docs-map` — lifecycle utilities for the docs-map artifact.
 *
 * stub:     deterministic scaffold — find pages that look like option docs,
 *           rank spec types by key overlap, emit a skeleton map. No LLM; an
 *           agent (drift-docs-map skill) or human reviews and fills the gaps.
 * baseline: tighten baselineGaps to current counts (ratchet — never raises;
 *           loosening requires a human editing the committed map).
 */

import { writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { collectTypeKeys, extractDocumentedKeys } from '@driftdev/sdk';
import type { ApiSpec } from '@driftdev/sdk/types';
import type { Command } from 'commander';
import { type DocsMapPage, loadDocsMap } from '../config/docs-map';
import { loadConfig } from '../config/loader';
import { detectEntry } from '../utils/detect-entry';
import { resolveDocsCorpus } from '../utils/docs-corpus';
import { runDocsCoverage } from '../utils/key-coverage-runner';
import { resolveLang, resolveTruth } from '../utils/load-spec';
import { formatError, formatOutput } from '../utils/output';
import { getVersion } from '../utils/version';

const MATCH_ALL = /(?:)/;
const MIN_PAGE_KEYS = 3;
const MIN_OVERLAP = 3;

interface StubCandidate {
  page: string;
  keys: number;
  type: string;
  candidates: Array<{ type: string; overlap: number; keys: number }>;
}

function typeKeySets(spec: ApiSpec): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const entry of [...spec.exports, ...(spec.types ?? [])]) {
    const keys = new Set(collectTypeKeys(entry).keys());
    if (keys.size >= MIN_OVERLAP && !out.has(entry.name)) out.set(entry.name, keys);
  }
  return out;
}

export function registerDocsMapCommand(program: Command): void {
  const docsMap = program
    .command('docs-map')
    .description('Docs-map lifecycle: scaffold and ratchet the page→type artifact');

  docsMap
    .command('stub')
    .description('Scaffold a docs map: option-doc pages + type candidates ranked by key overlap')
    .option('--docs <patterns...>', 'Docs corpus: glob patterns or directories')
    .option('--lang <language>', 'Source language (inferred otherwise)')
    .option('--abi <path>', 'ABI JSON file (Clarity)')
    .option('--spec <path>', 'OpenAPI document path or URL')
    .option('--out <file>', 'Write the stub map to a file (default: stdout only)')
    .action(
      async (options: {
        docs?: string[];
        lang?: string;
        abi?: string;
        spec?: string;
        out?: string;
      }) => {
        const startTime = Date.now();
        const version = getVersion();
        try {
          const lang = resolveLang({ lang: options.lang, spec: options.spec, abi: options.abi });
          const { config } = loadConfig();
          const entryFile =
            lang === 'typescript'
              ? config.entry
                ? path.resolve(process.cwd(), config.entry)
                : detectEntry()
              : undefined;
          const { apiSpec } = await resolveTruth({
            entry: entryFile,
            lang,
            spec: options.spec,
            abi: options.abi,
          });
          const types = typeKeySets(apiSpec);

          const corpus = resolveDocsCorpus(process.cwd(), options.docs, config.docs);
          const pages: StubCandidate[] = [];
          for (const file of corpus) {
            // Match-all section regex: at stub time we don't know the heading
            // convention yet, so any table with backticked keys counts.
            const extraction = extractDocumentedKeys(
              [{ path: file.path, content: file.content ?? '' }],
              MATCH_ALL,
            );
            const pageKeys = new Set(extraction.documented.keys());
            if (pageKeys.size < MIN_PAGE_KEYS) continue;

            const ranked = [...types.entries()]
              .map(([name, keys]) => ({
                type: name,
                overlap: [...pageKeys].filter((k) => keys.has(k)).length,
                keys: keys.size,
              }))
              .filter((c) => c.overlap >= MIN_OVERLAP)
              .sort((a, b) => b.overlap - a.overlap)
              .slice(0, 3);
            if (ranked.length === 0) continue;

            pages.push({
              page: path.relative(process.cwd(), file.path),
              keys: pageKeys.size,
              type: ranked[0].type,
              candidates: ranked,
            });
          }

          const stub = {
            $schema: 'https://unpkg.com/@driftdev/cli/schemas/drift.docs-map.schema.json',
            version: 1 as const,
            pages: pages.map((p) => ({
              page: p.page,
              type: p.type,
              baselineGaps: 0,
            })),
          };

          if (options.out) {
            writeFileSync(
              path.resolve(process.cwd(), options.out),
              `${JSON.stringify(stub, null, 2)}\n`,
            );
          }

          formatOutput(
            'docs-map stub',
            { candidates: pages, stub, ...(options.out ? { written: options.out } : {}) },
            startTime,
            version,
            undefined,
            {
              suggested: 'drift-docs-map skill',
              reason: 'review type mappings, add sectionRe/annotations, then set baselines',
            },
          );
        } catch (err) {
          formatError(
            'docs-map stub',
            err instanceof Error ? err.message : String(err),
            startTime,
            version,
          );
        }
      },
    );

  docsMap
    .command('baseline')
    .description('Tighten baselineGaps to current gap counts (ratchet — never raises)')
    .argument('<map>', 'Docs map file')
    .action(async (mapArg: string) => {
      const startTime = Date.now();
      const version = getVersion();
      try {
        const loaded = loadDocsMap(mapArg);
        // Fallback spec for pages without spec/entry: the current package
        let fallback: ApiSpec | undefined;
        try {
          const { config } = loadConfig();
          const entryFile = config.entry
            ? path.resolve(process.cwd(), config.entry)
            : detectEntry();
          fallback = (await resolveTruth({ entry: entryFile })).apiSpec;
        } catch {
          // No resolvable package here — fine if every page carries spec/entry
        }
        const run = await runDocsCoverage(loaded, fallback);
        const changes: Array<{ page: string; from: number; to: number }> = [];

        for (const result of run.pages) {
          const entry = loaded.map.pages.find((p: DocsMapPage) => p.page === result.page);
          if (!entry) continue;
          const current = result.result.counts.gapsUserFacing;
          const existing = entry.baselineGaps;
          if (existing === undefined || current < existing) {
            changes.push({ page: result.page, from: existing ?? current, to: current });
            entry.baselineGaps = current;
          }
        }

        if (changes.length > 0) {
          const out = {
            $schema: (loaded.map as unknown as Record<string, unknown>).$schema,
            ...loaded.map,
          };
          writeFileSync(loaded.mapPath, `${JSON.stringify(out, null, 2)}\n`);
        }

        formatOutput('docs-map baseline', { changes, map: loaded.mapPath }, startTime, version);
      } catch (err) {
        formatError(
          'docs-map baseline',
          err instanceof Error ? err.message : String(err),
          startTime,
          version,
        );
      }
    });
}
