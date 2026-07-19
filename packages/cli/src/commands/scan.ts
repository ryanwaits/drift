import * as path from 'node:path';
import {
  buildExportRegistry,
  computeDrift,
  detectProseDrift,
  isExternalExport,
  type KeyCoverageResult,
} from '@driftdev/sdk';
import type { Command } from 'commander';
import { cachedExtract } from '../cache/cached-extract';
import { loadDocsMap } from '../config/docs-map';
import { loadConfig } from '../config/loader';
import { renderBatchScan, renderScan } from '../formatters/scan';
import { emitAnnotations } from '../utils/annotations';
import { detectEntry } from '../utils/detect-entry';
import { readPackageName, resolveDocsCorpus } from '../utils/docs-corpus';
import { computeHealth } from '../utils/health';
import { type DocsCoverageRun, runDocsCoverage } from '../utils/key-coverage-runner';
import { resolveLang, resolveTruth } from '../utils/load-spec';
import { formatError, formatOutput, formatWarning, type OutputNext } from '../utils/output';
import { computeRatchetMin } from '../utils/ratchet';
import { shouldRenderHuman } from '../utils/render';
import { getVersion } from '../utils/version';
import { discoverPackages, filterPublic } from '../utils/workspaces';

interface LintIssue {
  export: string;
  issue: string;
  location?: string;
  filePath?: string;
  line?: number;
}

export interface ScanResult {
  coverage: {
    score: number;
    documented: number;
    total: number;
    undocumented: number;
    /** External re-exports excluded from `total` (docs not resolvable here) */
    external?: number;
  };
  lint: { issues: LintIssue[]; count: number };
  health: number;
  pass: boolean;
  packageName?: string;
  packageVersion?: string;
  /** Key-coverage results, present when --docs-map is set */
  docsCoverage?: {
    pass: boolean;
    pages: Array<{
      page: string;
      type: string;
      status: 'pass' | 'warn' | 'fail';
      baselineGaps: number;
      counts: KeyCoverageResult['counts'];
      failures: string[];
      warnings: string[];
      gaps: KeyCoverageResult['gaps'];
      ghosts: KeyCoverageResult['ghosts'];
      inversions: KeyCoverageResult['inversions'];
      documentedKeysFromOtherTypes: string[];
      annotated: KeyCoverageResult['annotated'];
    }>;
  };
}

export function registerScanCommand(program: Command): void {
  program
    .command('scan [entry]')
    .description('Run coverage + lint + prose drift in one pass')
    .option('--min <n>', 'Minimum health threshold (exit 1 if below)')
    .option('--all', 'Run across all workspace packages')
    .option('--private', 'Include private packages in --all mode')
    .option(
      '--lang <language>',
      'Source language (inferred from --spec/--abi/.clar; default typescript)',
    )
    .option('--abi <path>', 'ABI JSON file (required for --lang clarity)')
    .option('--spec <path>', 'OpenAPI document: path or URL (implies --lang openapi)')
    .option(
      '--docs <patterns...>',
      'Markdown corpus for prose drift: glob patterns or directories (overrides repo-local defaults)',
    )
    .option(
      '--docs-map <file>',
      'Docs map (page→type) activating key-coverage mode: gaps/ghosts/inversions per page',
    )
    .option('--annotations', 'Emit GitHub Actions ::error/::warning annotations for findings')
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
          docs?: string[];
          docsMap?: string;
          annotations?: boolean;
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
              'scan',
              `Batch mode (--all) not yet supported for ${lang}`,
              startTime,
              version,
            );
            return;
          }
          if (options.all && options.docsMap) {
            formatError('scan', '--docs-map is not supported with --all', startTime, version);
            return;
          }
          if (lang === 'clarity' && !options.abi) {
            formatError('scan', '--abi is required when --lang clarity', startTime, version);
            return;
          }
          if (lang === 'openapi' && !options.spec) {
            formatError('scan', '--spec is required when --lang openapi', startTime, version);
            return;
          }

          // Batch mode
          if (options.all) {
            const allPackages = discoverPackages(process.cwd());
            if (!allPackages || allPackages.length === 0) {
              formatError('scan', 'No workspace packages found', startTime, version);
              return;
            }
            const skipped = options.private
              ? []
              : allPackages.filter((p) => p.private).map((p) => p.name);
            const packages = options.private ? allPackages : filterPublic(allPackages);
            if (packages.length === 0) {
              formatError('scan', 'No workspace packages found', startTime, version);
              return;
            }

            const rows: Array<{
              name: string;
              exports: number;
              coverage: number;
              lintIssues: number;
              health: number;
            }> = [];
            let anyFail = false;

            for (const pkg of packages) {
              const { spec } = await cachedExtract(pkg.entry);
              const exps = (spec.exports ?? []).filter((e) => !isExternalExport(e));
              let documented = 0;
              for (const e of exps) {
                if (e.description?.trim()) documented++;
              }
              const coverage = exps.length > 0 ? Math.round((documented / exps.length) * 100) : 100;

              const driftResult = computeDrift(spec);
              const issues: Array<{ export: string; issue: string }> = [];
              for (const [exportName, drifts] of driftResult.exports) {
                for (const d of drifts) issues.push({ export: exportName, issue: d.issue });
              }

              const h = computeHealth(exps.length, documented, issues);
              const min = options.min ? parseInt(options.min, 10) : undefined;
              if (min !== undefined && h.health < min) anyFail = true;

              rows.push({
                name: pkg.name,
                exports: exps.length,
                coverage,
                lintIssues: issues.length,
                health: h.health,
              });
            }

            const data = { packages: rows, ...(skipped.length > 0 ? { skipped } : {}) };
            const totalIssues = rows.reduce((s, r) => s + r.lintIssues, 0);
            const batchNext: OutputNext | undefined =
              totalIssues > 0
                ? {
                    suggested: 'drift-fix skill',
                    reason: `${totalIssues} issues across ${rows.filter((r) => r.lintIssues > 0).length} packages`,
                  }
                : undefined;
            formatOutput('scan', data, startTime, version, renderBatchScan, batchNext);
            if (anyFail) process.exitCode = 1;
            return;
          }

          // Single-package mode
          const { config } = loadConfig();
          let entryFile = entry ? path.resolve(process.cwd(), entry) : undefined;
          if (lang === 'typescript' && !entryFile) {
            entryFile = config.entry ? path.resolve(process.cwd(), config.entry) : detectEntry();
          }
          const { apiSpec, packageName, packageVersion } = await resolveTruth({
            entry: entryFile,
            lang,
            spec: options.spec,
            abi: options.abi,
          });

          // Coverage — external re-exports excluded: their docs live in
          // another package, so counting them inflates the denominator
          const allExports = apiSpec.exports ?? [];
          const exports = allExports.filter((exp) => !isExternalExport(exp));
          const external = allExports.length - exports.length;
          const total = exports.length;
          let documented = 0;
          for (const exp of exports) {
            if (exp.description?.trim()) documented++;
          }
          const coverageScore = total > 0 ? Math.round((documented / total) * 100) : 100;

          // Drift
          const driftResult = computeDrift(apiSpec);
          const issues: LintIssue[] = [];
          for (const [exportName, drifts] of driftResult.exports) {
            for (const drift of drifts) {
              issues.push({
                export: exportName,
                issue: drift.issue,
                ...(drift.target ? { location: drift.target } : {}),
                filePath: drift.filePath,
                line: drift.line,
              });
            }
          }

          // Prose drift — TS by default (import heuristics assume npm
          // packages); an explicit --docs corpus runs for any language
          if (lang === 'typescript' || options.docs) {
            try {
              const pkgName = readPackageName() ?? packageName;
              if (pkgName) {
                const registry = buildExportRegistry(apiSpec);
                const markdownFiles = resolveDocsCorpus(process.cwd(), options.docs, config.docs);
                const proseDrifts = detectProseDrift({
                  packageName: pkgName,
                  markdownFiles,
                  registry,
                });
                for (const drift of proseDrifts) {
                  issues.push({
                    export: drift.target ?? '',
                    issue: drift.issue,
                    ...(drift.suggestion ? { location: drift.suggestion } : {}),
                    filePath: drift.filePath,
                    line: drift.line,
                  });
                }
              }
            } catch (err) {
              formatWarning(
                `Prose drift skipped: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }

          // Key coverage (docs-map mode)
          let docsCoverage: DocsCoverageRun | undefined;
          if (options.docsMap) {
            const loaded = loadDocsMap(options.docsMap);
            docsCoverage = await runDocsCoverage(loaded, apiSpec);
          }

          // Health
          const healthIssues = issues.map((i) => ({ export: i.export, issue: i.issue }));
          const h = computeHealth(total, documented, healthIssues);

          let min = options.min ? parseInt(options.min, 10) : config.coverage?.min;
          if (min !== undefined && config.coverage?.ratchet) {
            const ratchet = computeRatchetMin(min);
            min = ratchet.effectiveMin;
          }
          const pass = (min === undefined || h.health >= min) && (docsCoverage?.pass ?? true);

          const data: ScanResult = {
            coverage: {
              score: coverageScore,
              documented,
              total,
              undocumented: total - documented,
              ...(external > 0 ? { external } : {}),
            },
            lint: { issues, count: issues.length },
            health: h.health,
            pass,
            packageName,
            packageVersion,
            ...(docsCoverage
              ? {
                  docsCoverage: {
                    pass: docsCoverage.pass,
                    pages: docsCoverage.pages.map((p) => ({
                      page: p.page,
                      type: p.type,
                      status: p.status,
                      baselineGaps: p.baselineGaps,
                      counts: p.result.counts,
                      failures: p.failures,
                      warnings: p.warnings,
                      gaps: p.result.gaps,
                      ghosts: p.result.ghosts,
                      inversions: p.result.inversions,
                      documentedKeysFromOtherTypes: p.result.documentedKeysFromOtherTypes,
                      annotated: p.result.annotated,
                    })),
                  },
                }
              : {}),
          };

          // Compute next action hint
          let next: OutputNext | undefined;
          if (issues.length > 0) {
            next = {
              suggested: 'drift-fix skill',
              reason: `${issues.length} issue${issues.length === 1 ? '' : 's'} found`,
            };
          } else if (total - documented > 0) {
            next = {
              suggested: 'drift-enrich skill',
              reason: `${total - documented} exports lack documentation`,
            };
          }

          formatOutput('scan', data, startTime, version, renderScan, next);

          if (options.annotations && docsCoverage) {
            emitAnnotations(docsCoverage.annotations.errors, 'error');
            emitAnnotations(docsCoverage.annotations.warnings, 'warning');
          }
          if (options.annotations && issues.length > 0) emitAnnotations(issues);

          if (!pass) {
            if (!shouldRenderHuman()) {
              const covFails = docsCoverage
                ? docsCoverage.pages.flatMap((p) => p.failures.map((f) => `${p.page}: ${f}`))
                : [];
              process.stderr.write(
                `scan failed: health ${h.health}%${min !== undefined ? ` (need ${min}%)` : ''}, ${issues.length} issues${covFails.length > 0 ? `; docs coverage: ${covFails.join(' | ')}` : ''}\n`,
              );
            }
            process.exitCode = 1;
          }
        } catch (err) {
          formatError('scan', err instanceof Error ? err.message : String(err), startTime, version);
        }
      },
    );
}
