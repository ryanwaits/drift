import { readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { buildExportRegistry, computeDrift, detectProseDrift, discoverMarkdownFiles, isFixableDrift } from '@driftdev/sdk';
import { cachedExtract } from '../cache/cached-extract';
import { loadConfig } from '../config/loader';
import { renderBatchScan, renderScan } from '../formatters/scan';
import { detectEntry } from '../utils/detect-entry';
import { computeHealth } from '../utils/health';
import { formatError, formatOutput, type OutputNext } from '../utils/output';
import { computeRatchetMin } from '../utils/ratchet';
import { shouldRenderHuman } from '../utils/render';
import { discoverPackages, filterPublic } from '../utils/workspaces';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getPackageInfo(cwd: string): { name?: string; version?: string } {
  const pkgPath = path.join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return {};
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return { name: pkg.name, version: pkg.version };
  } catch {
    return {};
  }
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
    .action(async (entry: string | undefined, options: { min?: string; all?: boolean; private?: boolean }) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        // Batch mode
        if (options.all) {
          const allPackages = discoverPackages(process.cwd());
          if (!allPackages || allPackages.length === 0) {
            formatError('scan', 'No workspace packages found', startTime, version);
            return;
          }
          const skipped = options.private ? [] : allPackages.filter((p) => p.private).map((p) => p.name);
          const packages = options.private ? allPackages : filterPublic(allPackages);
          if (packages.length === 0) {
            formatError('scan', 'No workspace packages found', startTime, version);
            return;
          }

          const rows: Array<{ name: string; exports: number; coverage: number; lintIssues: number; health: number }> = [];
          let anyFail = false;

          for (const pkg of packages) {
            const { spec } = await cachedExtract(pkg.entry);
            const exps = spec.exports ?? [];
            let documented = 0;
            for (const e of exps) { if (e.description?.trim()) documented++; }
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
          const batchNext: OutputNext | undefined = totalIssues > 0
            ? { suggested: 'drift-fix skill', reason: `${totalIssues} issues across ${rows.filter(r => r.lintIssues > 0).length} packages` }
            : undefined;
          formatOutput('scan', data, startTime, version, renderBatchScan, batchNext);
          if (anyFail) process.exitCode = 1;
          return;
        }

        // Single-package mode
        const { config } = loadConfig();
        const entryFile = entry
          ? path.resolve(process.cwd(), entry)
          : config.entry
            ? path.resolve(process.cwd(), config.entry)
            : detectEntry();
        const { spec } = await cachedExtract(entryFile);

        // Coverage
        const exports = spec.exports ?? [];
        const total = exports.length;
        let documented = 0;
        for (const exp of exports) {
          if (exp.description?.trim()) documented++;
        }
        const coverageScore = total > 0 ? Math.round((documented / total) * 100) : 100;

        // JSDoc drift
        const driftResult = computeDrift(spec);
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

        // Prose drift
        try {
          const pkgJsonPath = path.resolve(process.cwd(), 'package.json');
          const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
          const packageName = pkgJson.name as string | undefined;
          if (packageName) {
            const registry = buildExportRegistry(spec);
            const markdownFiles = discoverMarkdownFiles(process.cwd(), config.docs);
            const proseDrifts = detectProseDrift({ packageName, markdownFiles, registry });
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
        } catch {}

        // Health
        const healthIssues = issues.map((i) => ({ export: i.export, issue: i.issue }));
        const h = computeHealth(total, documented, healthIssues);
        const pkg = getPackageInfo(process.cwd());

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
          packageName: pkg.name,
          packageVersion: pkg.version,
        };

        // Compute next action hint
        let next: OutputNext | undefined;
        if (issues.length > 0) {
          let fixableCount = 0;
          for (const [, drs] of driftResult.exports) {
            for (const d of drs) { if (isFixableDrift(d)) fixableCount++; }
          }
          next = { suggested: 'drift-fix skill', reason: `${fixableCount} of ${issues.length} issues are auto-fixable` };
        } else if (total - documented > 0) {
          next = { suggested: 'drift-enrich skill', reason: `${total - documented} exports lack documentation` };
        }

        formatOutput('scan', data, startTime, version, renderScan, next);

        if (!pass) {
          if (!shouldRenderHuman()) {
            process.stderr.write(`scan failed: health ${h.health}%${min !== undefined ? ` (need ${min}%)` : ''}, ${issues.length} issues\n`);
          }
          process.exitCode = 1;
        }
      } catch (err) {
        formatError('scan', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
