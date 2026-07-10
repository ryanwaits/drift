import * as path from 'node:path';
import { isExternalExport } from '@driftdev/sdk';
import type { Command } from 'commander';
import { cachedExtract } from '../cache/cached-extract';
import { loadConfig } from '../config/loader';
import { renderBatchCoverage } from '../formatters/batch';
import { renderCoverage } from '../formatters/coverage';
import { detectEntry } from '../utils/detect-entry';
import { resolveLang, resolveTruth } from '../utils/load-spec';
import { formatError, formatOutput, type OutputNext } from '../utils/output';
import { computeRatchetMin } from '../utils/ratchet';
import { shouldRenderHuman } from '../utils/render';
import { getVersion } from '../utils/version';
import { discoverPackages, filterPublic } from '../utils/workspaces';

export function registerCoverageCommand(program: Command): void {
  program
    .command('coverage [entry]')
    .description('Measure documentation coverage')
    .option('--min <n>', 'Minimum coverage threshold (exit 1 if below)')
    .option('--all', 'Run across all workspace packages')
    .option('--private', 'Include private packages in --all mode')
    .option(
      '--lang <language>',
      'Source language (inferred from --spec/--abi/.clar; default typescript)',
    )
    .option('--abi <path>', 'ABI JSON file (required for --lang clarity)')
    .option('--spec <path>', 'OpenAPI document: path or URL (implies --lang openapi)')
    .action(
      async (
        entry: string | undefined,
        options: {
          min?: string;
          all?: boolean;
          private?: boolean;
          lang?: string;
          abi?: string;
          spec?: string;
        },
      ) => {
        const startTime = Date.now();
        const version = getVersion();

        try {
          const lang = resolveLang({
            entry,
            lang: options.lang,
            spec: options.spec,
            abi: options.abi,
          });
          if (lang !== 'typescript' && options.all) {
            formatError(
              'coverage',
              `Batch mode (--all) not yet supported for ${lang}`,
              startTime,
              version,
            );
            return;
          }

          // --all batch mode
          if (options.all) {
            const allPackages = discoverPackages(process.cwd());
            if (!allPackages || allPackages.length === 0) {
              formatError('coverage', 'No workspace packages found', startTime, version);
              return;
            }
            const skipped = options.private
              ? []
              : allPackages.filter((p) => p.private).map((p) => p.name);
            const packages = options.private ? allPackages : filterPublic(allPackages);
            if (packages.length === 0) {
              formatError('coverage', 'No workspace packages found', startTime, version);
              return;
            }
            const rows: Array<{ name: string; exports: number; score: number }> = [];
            let totalDoc = 0;
            let totalAll = 0;
            for (const pkg of packages) {
              const { spec } = await cachedExtract(pkg.entry);
              const exps = (spec.exports ?? []).filter((e) => !isExternalExport(e));
              let doc = 0;
              for (const e of exps) {
                if (e.description?.trim()) doc++;
              }
              const score = exps.length > 0 ? Math.round((doc / exps.length) * 100) : 100;
              rows.push({ name: pkg.name, exports: exps.length, score });
              totalDoc += doc;
              totalAll += exps.length;
            }
            const aggScore = totalAll > 0 ? Math.round((totalDoc / totalAll) * 100) : 100;
            const data = {
              packages: rows,
              aggregate: { score: aggScore, documented: totalDoc, total: totalAll },
              ...(skipped.length > 0 ? { skipped } : {}),
            };
            formatOutput('coverage', data, startTime, version, renderBatchCoverage);
            const minT = options.min ? parseInt(options.min, 10) : undefined;
            if (minT !== undefined && aggScore < minT) process.exitCode = 1;
            return;
          }

          const { config } = loadConfig();
          let entryFile = entry ? path.resolve(process.cwd(), entry) : undefined;
          if (lang === 'typescript' && !entryFile) {
            entryFile = config.entry ? path.resolve(process.cwd(), config.entry) : detectEntry();
          }
          const { apiSpec: spec } = await resolveTruth({
            entry: entryFile,
            lang,
            spec: options.spec,
            abi: options.abi,
          });

          // External re-exports excluded — their docs live in another package
          const allExports = spec.exports ?? [];
          const exports = allExports.filter((exp) => !isExternalExport(exp));
          const external = allExports.length - exports.length;
          const total = exports.length;
          const undocumented: string[] = [];

          for (const exp of exports) {
            if (!exp.description || exp.description.trim().length === 0) {
              undocumented.push(exp.name);
            }
          }

          const documented = total - undocumented.length;
          const score = total > 0 ? Math.round((documented / total) * 100) : 100;

          const data = {
            score,
            documented,
            total,
            undocumented,
            ...(external > 0 ? { external } : {}),
          };

          const next: OutputNext | undefined =
            undocumented.length > 0
              ? {
                  suggested: 'drift-enrich skill',
                  reason: `${undocumented.length} exports lack documentation`,
                }
              : undefined;

          formatOutput('coverage', data, startTime, version, renderCoverage, next);

          let minThreshold = options.min ? parseInt(options.min, 10) : config.coverage?.min;
          if (minThreshold !== undefined && config.coverage?.ratchet) {
            const ratchet = computeRatchetMin(minThreshold);
            minThreshold = ratchet.effectiveMin;
            if (score < minThreshold && ratchet.watermark !== null) {
              const msg = `coverage ${score}% below ratchet ${minThreshold}% (watermark ${ratchet.watermark}% on ${ratchet.watermarkDate ?? 'unknown'})`;
              if (!shouldRenderHuman()) {
                process.stderr.write(`${msg}\n`);
              }
              process.exitCode = 1;
              return;
            }
          }
          if (minThreshold !== undefined) {
            if (score < minThreshold) {
              const delta = minThreshold - score;
              if (!shouldRenderHuman()) {
                process.stderr.write(
                  `coverage ${score}% (need ${minThreshold}%, -${delta} to go)\n`,
                );
              }
              process.exitCode = 1;
            }
          }
        } catch (err) {
          formatError(
            'coverage',
            err instanceof Error ? err.message : String(err),
            startTime,
            version,
          );
        }
      },
    );
}
