import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { computeDrift } from '@doccov/sdk';
import { cachedExtract } from '../cache/cached-extract';
import { loadConfig } from '../config/loader';
import { renderCi } from '../formatters/ci';
import { detectEntry } from '../utils/detect-entry';
import { getGitHubContext, getPRNumber, postOrUpdatePRComment, writeStepSummary } from '../utils/github';
import { appendHistory } from '../utils/history';
import { formatError, formatOutput } from '../utils/output';
import { detectWorkspaces, resolveGlobs } from '../utils/workspaces';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

interface PackageResult {
  name: string;
  coverage: number;
  coveragePass: boolean;
  lintIssues: number;
  lintPass: boolean;
  exports: number;
  pass: boolean;
}

function getChangedFiles(baseRef: string): string[] {
  try {
    const output = execSync(`git diff --name-only origin/${baseRef}...HEAD`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getCommitSha(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

function detectPackageDirs(cwd: string): string[] {
  const workspaces = detectWorkspaces(cwd);
  if (!workspaces) return ['.'];
  return resolveGlobs(cwd, workspaces);
}

function filterChangedPackages(allDirs: string[], changedFiles: string[]): string[] {
  if (changedFiles.length === 0) return allDirs;
  return allDirs.filter((dir) => {
    const prefix = dir === '.' ? '' : dir + '/';
    return changedFiles.some((f) => prefix === '' || f.startsWith(prefix));
  });
}

function buildMarkdownTable(results: PackageResult[], pass: boolean): string {
  const lines: string[] = [];
  lines.push('## Drift CI Results\n');
  lines.push('| Package | Exports | Coverage | Lint | Status |');
  lines.push('|---------|---------|----------|------|--------|');
  for (const r of results) {
    const cov = r.coveragePass ? `${r.coverage}%` : `${r.coverage}% ❌`;
    const lint = r.lintPass ? `${r.lintIssues} issues` : `${r.lintIssues} issues ❌`;
    const status = r.pass ? '✅' : '❌';
    lines.push(`| ${r.name} | ${r.exports} | ${cov} | ${lint} | ${status} |`);
  }
  lines.push('');
  lines.push(pass ? '**All checks passed.**' : '**Some checks failed.**');
  return lines.join('\n');
}

export function registerCiCommand(program: Command): void {
  program
    .command('ci')
    .description('Run CI checks on changed packages')
    .option('--all', 'Check all packages, not just changed ones')
    .action(async (options: { all?: boolean }) => {
      const startTime = Date.now();
      const version = getVersion();
      const cwd = process.cwd();

      try {
        const { config } = loadConfig();
        const gh = getGitHubContext();
        const allDirs = detectPackageDirs(cwd);

        // Determine which packages to check
        let packageDirs: string[];
        if (options.all || !gh.isPR || !gh.baseRef) {
          packageDirs = allDirs;
        } else {
          const changed = getChangedFiles(gh.baseRef);
          packageDirs = filterChangedPackages(allDirs, changed);
        }

        if (packageDirs.length === 0) packageDirs = allDirs;

        const minThreshold = config.coverage?.min ?? 0;
        const results: PackageResult[] = [];
        const commit = gh.sha?.slice(0, 7) ?? getCommitSha();

        for (const dir of packageDirs) {
          const absDir = dir === '.' ? cwd : path.join(cwd, dir);
          if (!existsSync(absDir)) continue;

          // Read package name
          let name = dir;
          const pkgPath = path.join(absDir, 'package.json');
          if (existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
              if (pkg.name) name = pkg.name;
            } catch {}
          }

          try {
            const entryFile = detectEntry(absDir);
            const { spec } = await cachedExtract(entryFile);

            // Coverage
            const exports = spec.exports ?? [];
            const total = exports.length;
            let documented = 0;
            for (const exp of exports) {
              if (exp.description && exp.description.trim().length > 0) documented++;
            }
            const coverage = total > 0 ? Math.round((documented / total) * 100) : 100;
            const coveragePass = coverage >= minThreshold;

            // Lint
            const driftResult = computeDrift(spec);
            let lintIssues = 0;
            for (const [, drifts] of driftResult.exports) {
              lintIssues += drifts.length;
            }
            const lintPass = config.lint === false || lintIssues === 0;

            results.push({
              name,
              coverage,
              coveragePass,
              lintIssues,
              lintPass,
              exports: total,
              pass: coveragePass && lintPass,
            });
          } catch {
            results.push({
              name,
              coverage: 0,
              coveragePass: false,
              lintIssues: 0,
              lintPass: true,
              exports: 0,
              pass: false,
            });
          }
        }

        const allPass = results.every((r) => r.pass);

        // History tracking (13.3)
        const now = new Date().toISOString().slice(0, 10);
        appendHistory(
          results.map((r) => ({
            date: now,
            package: r.name,
            coverage: r.coverage,
            lint: r.lintIssues,
            exports: r.exports,
            ...(commit ? { commit } : {}),
          })),
        );

        // PR comment / step summary (13.2)
        if (gh.isPR && gh.token && gh.repository) {
          const md = buildMarkdownTable(results, allPass);
          writeStepSummary(md);
          const prNumber = getPRNumber(gh.eventPath);
          if (prNumber) {
            try {
              await postOrUpdatePRComment(gh.repository, prNumber, gh.token, md);
            } catch {}
          }
        }

        const data = { results, pass: allPass, min: minThreshold };
        formatOutput('ci', data, startTime, version, renderCi);

        if (!allPass) process.exitCode = 1;
      } catch (err) {
        formatError('ci', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
