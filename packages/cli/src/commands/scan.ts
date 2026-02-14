import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fromSource } from '@driftdev/clarity-adapter';
import {
  buildExportRegistry,
  computeDrift,
  detectProseDrift,
  discoverMarkdownFiles,
} from '@driftdev/sdk';
import type { ApiSpec } from '@driftdev/sdk/types';
import type { Command } from 'commander';
import { cachedExtract } from '../cache/cached-extract';
import { loadConfig } from '../config/loader';
import { renderBatchScan, renderScan } from '../formatters/scan';
import { detectEntry } from '../utils/detect-entry';
import { computeHealth } from '../utils/health';
import { formatError, formatOutput, formatWarning, type OutputNext } from '../utils/output';
import { computeRatchetMin } from '../utils/ratchet';
import { shouldRenderHuman } from '../utils/render';
import { getVersion } from '../utils/version';
import { discoverPackages, filterPublic } from '../utils/workspaces';

function getPackageInfo(cwd: string): { name?: string; version?: string } {
  const pkgPath = path.join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return {};
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return { name: pkg.name, version: pkg.version };
  } catch (err) {
    formatWarning(`Could not parse package.json${err instanceof Error ? `: ${err.message}` : ''}`);
    return {};
  }
}

type SupportedLang = 'typescript' | 'clarity';

async function loadSpec(
  entryFile: string,
  lang: SupportedLang,
  abiPath?: string,
): Promise<{ apiSpec: ApiSpec; packageName?: string; packageVersion?: string }> {
  if (lang === 'clarity') {
    if (!abiPath) throw new Error('--abi is required when --lang clarity');
    if (!existsSync(entryFile)) throw new Error(`Source file not found: ${entryFile}`);
    if (!existsSync(abiPath)) throw new Error(`ABI file not found: ${abiPath}`);
    const source = readFileSync(entryFile, 'utf-8');
    const abi = JSON.parse(readFileSync(abiPath, 'utf-8'));
    const name = path.basename(entryFile, path.extname(entryFile));
    const pkg = getPackageInfo(process.cwd());
    const apiSpec = fromSource(source, abi, { name, version: pkg.version });
    return { apiSpec, packageName: pkg.name ?? name, packageVersion: pkg.version };
  }

  // TypeScript (default)
  const { spec } = await cachedExtract(entryFile);
  const pkg = getPackageInfo(process.cwd());
  return { apiSpec: spec as ApiSpec, packageName: pkg.name, packageVersion: pkg.version };
}

interface LintIssue {
  export: string;
  issue: string;
  location?: string;
  filePath?: string;
  line?: number;
}

export interface ScanResult {
  coverage: { score: number; documented: number; total: number; undocumented: number };
  lint: { issues: LintIssue[]; count: number };
  health: number;
  pass: boolean;
  packageName?: string;
  packageVersion?: string;
}

export function registerScanCommand(program: Command): void {
  program
    .command('scan [entry]')
    .description('Run coverage + lint + prose drift in one pass')
    .option('--min <n>', 'Minimum health threshold (exit 1 if below)')
    .option('--all', 'Run across all workspace packages')
    .option('--private', 'Include private packages in --all mode')
    .option('--lang <language>', 'Source language', 'typescript')
    .option('--abi <path>', 'ABI JSON file (required for --lang clarity)')
    .action(
      async (
        entry: string | undefined,
        options: { min?: string; all?: boolean; private?: boolean; lang?: string; abi?: string },
      ) => {
        const startTime = Date.now();
        const version = getVersion();

        try {
          // Validate --lang
          const lang = (options.lang ?? 'typescript') as string;
          if (lang !== 'typescript' && lang !== 'clarity') {
            formatError('scan', `Unknown language: ${lang}`, startTime, version);
            return;
          }
          if (lang === 'clarity' && options.all) {
            formatError('scan', 'Batch mode (--all) not yet supported for clarity', startTime, version);
            return;
          }
          if (lang === 'clarity' && !options.abi) {
            formatError('scan', '--abi is required when --lang clarity', startTime, version);
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
              const exps = spec.exports ?? [];
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
          const entryFile = entry
            ? path.resolve(process.cwd(), entry)
            : lang === 'clarity'
              ? (() => { throw new Error('Entry file required for --lang clarity'); })()
              : config.entry
                ? path.resolve(process.cwd(), config.entry)
                : detectEntry();
          const abiPath = options.abi ? path.resolve(process.cwd(), options.abi) : undefined;
          const { apiSpec, packageName, packageVersion } = await loadSpec(entryFile, lang as SupportedLang, abiPath);

          // Coverage
          const exports = apiSpec.exports ?? [];
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

          // Prose drift (TS only — needs buildExportRegistry + TS-specific docs)
          if (lang === 'typescript') {
            try {
              const pkgJsonPath = path.resolve(process.cwd(), 'package.json');
              const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
              const pkgName = pkgJson.name as string | undefined;
              if (pkgName) {
                const registry = buildExportRegistry(apiSpec);
                const markdownFiles = discoverMarkdownFiles(process.cwd(), config.docs);
                const proseDrifts = detectProseDrift({ packageName: pkgName, markdownFiles, registry });
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
              formatWarning(`Prose drift skipped: ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          // Health
          const healthIssues = issues.map((i) => ({ export: i.export, issue: i.issue }));
          const h = computeHealth(total, documented, healthIssues);

          let min = options.min ? parseInt(options.min, 10) : config.coverage?.min;
          if (min !== undefined && config.coverage?.ratchet) {
            const ratchet = computeRatchetMin(min);
            min = ratchet.effectiveMin;
          }
          const pass = min === undefined || h.health >= min;

          const data: ScanResult = {
            coverage: { score: coverageScore, documented, total, undocumented: total - documented },
            lint: { issues, count: issues.length },
            health: h.health,
            pass,
            packageName,
            packageVersion,
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

          if (!pass) {
            if (!shouldRenderHuman()) {
              process.stderr.write(
                `scan failed: health ${h.health}%${min !== undefined ? ` (need ${min}%)` : ''}, ${issues.length} issues\n`,
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
