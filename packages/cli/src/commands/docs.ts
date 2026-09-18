/**
 * `drift docs` — lifecycle for the committed page→type file (`drift.docs.json`).
 *
 * init:     deterministic scaffold. Never networks.
 * propose:  opt-in Jev. Requires TYPESAFE_API_KEY. Never scan/CI.
 * baseline: tighten baselineGaps (ratchet — never raises).
 */

import { existsSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { extractDocumentedKeys } from '@driftdev/sdk';
import type { ApiSpec } from '@driftdev/sdk/types';
import type { Command } from 'commander';
import { DEFAULT_DOCS_FILE, type DocsMapPage, findDocsFile, loadDocsMap } from '../config/docs-map';
import { loadConfig } from '../config/loader';
import { DEFAULT_CONFIDENCE, loadEvaluate } from '../jev/evaluate';
import { type ProposePageInput, proposeDocsMap } from '../jev/propose';
import { detectEntry } from '../utils/detect-entry';
import { resolveDocsCorpus } from '../utils/docs-corpus';
import {
  collectStubCandidates,
  DOCS_MAP_SCHEMA,
  rankPageTypes,
  typeKeySets,
} from '../utils/docs-map-stub';
import { resolvePageSpec, resolvePages, runDocsCoverage } from '../utils/key-coverage-runner';
import { resolveLang, resolveTruth } from '../utils/load-spec';
import { formatError, formatOutput } from '../utils/output';
import { getVersion } from '../utils/version';

const CONFIG_SCHEMA = 'https://unpkg.com/@driftdev/cli/schemas/drift.config.schema.json';

function parseConfidence(raw?: string): number {
  if (raw === undefined) return DEFAULT_CONFIDENCE;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error('--confidence must be a number between 0 and 1');
  }
  return n;
}

async function fallbackSpec(opts: {
  lang?: string;
  spec?: string;
  abi?: string;
}): Promise<{ spec: ApiSpec; lang: ReturnType<typeof resolveLang> }> {
  const lang = resolveLang({ lang: opts.lang, spec: opts.spec, abi: opts.abi });
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
    spec: opts.spec,
    abi: opts.abi,
  });
  return { spec: apiSpec, lang };
}

function writeMap(file: string, pages: DocsMapPage[]): void {
  const out = {
    $schema: DOCS_MAP_SCHEMA,
    version: 1 as const,
    pages,
  };
  writeFileSync(path.resolve(process.cwd(), file), `${JSON.stringify(out, null, 2)}\n`);
}

function documentedKeys(files: Array<{ path: string; content: string }>): Set<string> {
  return new Set(extractDocumentedKeys(files, /(?:)/).documented.keys());
}

export function registerDocsCommand(program: Command): void {
  const docs = program.command('docs').description('Docs file lifecycle: init, propose, baseline');

  docs
    .command('init [dir]')
    .description('Scaffold drift.docs.json from option-doc pages (never networks)')
    .option('--docs <patterns...>', 'Docs corpus: glob patterns or directories')
    .option('--lang <language>', 'Source language (inferred otherwise)')
    .option('--abi <path>', 'ABI JSON file (Clarity)')
    .option('--spec <path>', 'OpenAPI document path or URL')
    .option('--out <file>', `Write path (default: ${DEFAULT_DOCS_FILE})`)
    .action(
      async (
        dir: string | undefined,
        options: {
          docs?: string[];
          lang?: string;
          abi?: string;
          spec?: string;
          out?: string;
        },
      ) => {
        const startTime = Date.now();
        const version = getVersion();
        try {
          const { spec } = await fallbackSpec(options);
          const { config, configPath } = loadConfig();
          const docsPatterns = options.docs ?? (dir ? [dir] : undefined);
          const corpus = resolveDocsCorpus(process.cwd(), docsPatterns, config.docs);
          const candidates = collectStubCandidates(corpus, typeKeySets(spec), process.cwd());
          const stub = {
            $schema: DOCS_MAP_SCHEMA,
            version: 1 as const,
            pages: candidates.map((p) => ({
              page: p.page,
              type: p.type,
              ...(p.sectionRe ? { sectionRe: p.sectionRe } : {}),
              baselineGaps: 0,
            })),
          };

          const outFile = options.out ?? DEFAULT_DOCS_FILE;
          writeFileSync(path.resolve(process.cwd(), outFile), `${JSON.stringify(stub, null, 2)}\n`);

          const includeDir = dir ?? options.docs?.[0];
          let configWritten: string | undefined;
          if (includeDir && !configPath) {
            const cfg = {
              $schema: CONFIG_SCHEMA,
              docs: { include: [includeDir] },
            };
            const cfgPath = path.resolve(process.cwd(), 'drift.config.json');
            if (!existsSync(cfgPath)) {
              writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
              configWritten = cfgPath;
            }
          }

          formatOutput(
            'docs init',
            {
              candidates,
              stub,
              written: outFile,
              ...(configWritten ? { config: configWritten } : {}),
            },
            startTime,
            version,
            undefined,
            {
              suggested: 'drift docs propose',
              reason: 'opt-in Jev confirm types + triage annotations, then review and commit',
            },
          );
        } catch (err) {
          formatError(
            'docs init',
            err instanceof Error ? err.message : String(err),
            startTime,
            version,
          );
        }
      },
    );

  docs
    .command('propose')
    .description(
      'Opt-in Jev propose: confirm page→type and triage gaps. Requires TYPESAFE_API_KEY. Never used by scan.',
    )
    .option('--docs <patterns...>', 'Docs corpus: glob patterns or directories')
    .option('--map <file>', `Docs file to refine (default: ${DEFAULT_DOCS_FILE})`)
    .option('--out <file>', 'Write the proposed file (default: overwrite --map)')
    .option('--lang <language>', 'Source language (inferred otherwise)')
    .option('--abi <path>', 'ABI JSON file (Clarity)')
    .option('--spec <path>', 'OpenAPI document path or URL')
    .option(
      '--confidence <n>',
      `Min confidence to write an annotation (default ${DEFAULT_CONFIDENCE})`,
    )
    .action(
      async (options: {
        docs?: string[];
        map?: string;
        out?: string;
        lang?: string;
        abi?: string;
        spec?: string;
        confidence?: string;
      }) => {
        const startTime = Date.now();
        const version = getVersion();
        try {
          const evaluate = await loadEvaluate();
          const confidence = parseConfidence(options.confidence);
          const mapFile = options.map ?? findDocsFile() ?? undefined;
          if (!mapFile && !options.docs) {
            throw new Error(
              'drift docs propose requires a docs file or --docs (run drift docs init)',
            );
          }

          let fallback: ApiSpec | undefined;
          try {
            fallback = (await fallbackSpec(options)).spec;
          } catch (err) {
            if (!mapFile) throw err;
          }

          const inputs: ProposePageInput[] = [];
          if (mapFile) {
            const loaded = loadDocsMap(mapFile);
            for (const page of loaded.map.pages) {
              const spec = await resolvePageSpec(page, loaded.dir, fallback);
              const files = resolvePages(page, loaded.dir);
              inputs.push({
                entry: { ...page },
                files,
                spec,
                candidates: rankPageTypes(documentedKeys(files), typeKeySets(spec)),
              });
            }
          } else {
            if (!fallback) throw new Error('Could not resolve a spec for --docs');
            const { config } = loadConfig();
            const corpus = resolveDocsCorpus(process.cwd(), options.docs, config.docs);
            const candidates = collectStubCandidates(corpus, typeKeySets(fallback), process.cwd());
            const byRel = new Map(corpus.map((f) => [path.relative(process.cwd(), f.path), f]));
            for (const c of candidates) {
              const file = byRel.get(c.page);
              inputs.push({
                entry: { page: c.page, type: c.type, baselineGaps: 0 },
                files: [{ path: file?.path ?? c.page, content: file?.content ?? '' }],
                spec: fallback,
                candidates: c.candidates,
              });
            }
          }

          const result = await proposeDocsMap({ evaluate, pages: inputs, confidence });
          const outFile = options.out ?? mapFile ?? DEFAULT_DOCS_FILE;
          writeMap(outFile, result.pages);

          formatOutput(
            'docs propose',
            {
              proposed: { $schema: DOCS_MAP_SCHEMA, version: 1, pages: result.pages },
              applied: result.applied,
              needsReview: result.needsReview,
              written: outFile,
            },
            startTime,
            version,
            undefined,
            {
              suggested: 'review needsReview, then drift && drift docs baseline',
              reason: 'human commits the file; CI is a set-diff against git (zero network)',
            },
          );
        } catch (err) {
          formatError(
            'docs propose',
            err instanceof Error ? err.message : String(err),
            startTime,
            version,
          );
        }
      },
    );

  docs
    .command('baseline [map]')
    .description('Tighten baselineGaps to current gap counts (ratchet — never raises)')
    .action(async (mapArg: string | undefined) => {
      const startTime = Date.now();
      const version = getVersion();
      try {
        const mapPath = mapArg ?? findDocsFile();
        if (!mapPath) throw new Error(`No ${DEFAULT_DOCS_FILE} found (run drift docs init)`);
        const loaded = loadDocsMap(mapPath);
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

        formatOutput('docs baseline', { changes, map: loaded.mapPath }, startTime, version);
      } catch (err) {
        formatError(
          'docs baseline',
          err instanceof Error ? err.message : String(err),
          startTime,
          version,
        );
      }
    });
}
