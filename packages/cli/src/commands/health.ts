import * as path from 'node:path';
import { computeDrift } from '@driftdev/sdk';
import type { Command } from 'commander';
import { cachedExtract } from '../cache/cached-extract';
import { loadConfig } from '../config/loader';
import { renderBatchCoverage } from '../formatters/batch';
import { renderHealth } from '../formatters/health';
import { detectEntry } from '../utils/detect-entry';
import { computeHealth } from '../utils/health';
import { resolveLang, resolveTruth } from '../utils/load-spec';
import { formatError, formatOutput, type OutputNext } from '../utils/output';
import { computeRatchetMin } from '../utils/ratchet';
import { shouldRenderHuman } from '../utils/render';
import { getVersion } from '../utils/version';
import { discoverPackages, filterPublic } from '../utils/workspaces';

export function registerHealthCommand(program: Command): void {
  program
    .command('health [entry]')
    .description('Show documentation health score')
    .option('--min <n>', 'Minimum health threshold (exit 1 if below)')
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
              'health',
              `Batch mode (--all) not yet supported for ${lang}`,
              startTime,
              version,
            );
            return;
          }
          // --all batch mode — reuse coverage-style aggregate for health
          if (options.all) {
            const allPackages = discoverPackages(process.cwd());
            if (!allPackages || allPackages.length === 0) {
              formatError('health', 'No workspace packages found', startTime, version);
              return;
            }
            const skipped = options.private
              ? []
              : allPackages.filter((p) => p.private).map((p) => p.name);
            const packages = options.private ? allPackages : filterPublic(allPackages);
            if (packages.length === 0) {
              formatError('health', 'No workspace packages found', startTime, version);
              return;
            }
            const rows: Array<{ name: string; exports: number; score: number }> = [];
            let totalDoc = 0;
            let totalAll = 0;
            for (const pkg of packages) {
              const { spec } = await cachedExtract(pkg.entry);
              const exps = spec.exports ?? [];
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
            formatOutput('health', data, startTime, version, renderBatchCoverage);
            return;
          }

          const { config } = loadConfig();
          let entryFile = entry ? path.resolve(process.cwd(), entry) : undefined;
          if (lang === 'typescript' && !entryFile) {
            entryFile = config.entry ? path.resolve(process.cwd(), config.entry) : detectEntry();
          }
          const {
            apiSpec: spec,
            packageName,
            packageVersion,
          } = await resolveTruth({ entry: entryFile, lang, spec: options.spec, abi: options.abi });

          // Coverage data
          const exports = spec.exports ?? [];
          const total = exports.length;
          let documented = 0;
          for (const exp of exports) {
            if (exp.description && exp.description.trim().length > 0) {
              documented++;
            }
          }

          // Lint data
          const driftResult = computeDrift(spec);
          const issues: Array<{ export: string; issue: string }> = [];
          for (const [exportName, drifts] of driftResult.exports) {
            for (const drift of drifts) {
              issues.push({ export: exportName, issue: drift.issue });
            }
          }

          const health = computeHealth(total, documented, issues);

          const data = {
            ...health,
            packageName,
            packageVersion,
          };

          let min = options.min ? parseInt(options.min, 10) : config.coverage?.min;
          if (min !== undefined && config.coverage?.ratchet) {
            const ratchet = computeRatchetMin(min);
            min = ratchet.effectiveMin;
          }

          let next: OutputNext | undefined;
          if (issues.length > 0) {
            next = {
              suggested: 'drift lint',
              reason: `${issues.length} drift issue${issues.length === 1 ? '' : 's'} found`,
            };
          } else if (total - documented > 0) {
            next = {
              suggested: 'drift list --undocumented',
              reason: `${total - documented} exports lack documentation`,
            };
          }

          formatOutput('health', { ...data, min }, startTime, version, renderHealth, next);

          // Threshold check
          if (min !== undefined && health.health < min) {
            const delta = min - health.health;
            if (!shouldRenderHuman()) {
              process.stderr.write(`health ${health.health}% (need ${min}%, -${delta} to go)\n`);
            }
            process.exitCode = 1;
          }
        } catch (err) {
          formatError(
            'health',
            err instanceof Error ? err.message : String(err),
            startTime,
            version,
          );
        }
      },
    );
}
