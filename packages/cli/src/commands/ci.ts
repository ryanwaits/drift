import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { computeDrift } from '@driftdev/sdk';
import { categorizeBreakingChanges, diffSpec } from '@openpkg-ts/spec';
import type { Command } from 'commander';
import { cachedExtract } from '../cache/cached-extract';
import { loadConfig } from '../config/loader';
import { renderCi } from '../formatters/ci';
import { writeContext } from '../utils/context-writer';
import { detectEntry } from '../utils/detect-entry';
import { extractSpecFromRef } from '../utils/git-extract';
import {
  getGitHubContext,
  getPRNumber,
  postOrUpdatePRComment,
  writeStepSummary,
} from '../utils/github';
import { appendHistory, readHistory } from '../utils/history';
import { formatError, formatOutput, type OutputNext } from '../utils/output';
import { computeRatchetMin } from '../utils/ratchet';
import { getVersion } from '../utils/version';
import { detectWorkspaces, resolveGlobs } from '../utils/workspaces';

interface PackageResult {
  name: string;
  coverage: number;
  coveragePass: boolean;
  lintIssues: number;
  lintPass: boolean;
  exports: number;
  pass: boolean;
  diff?: { breaking: Array<{ name: string; reason?: string }>; added: string[]; changed: string[] };
  undocumented?: string[];
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
    const prefix = dir === '.' ? '' : `${dir}/`;
    return changedFiles.some((f) => prefix === '' || f.startsWith(prefix));
  });
}

function buildPRComment(results: PackageResult[], _pass: boolean, commit: string | null): string {
  const lines: string[] = [];
  const multi = results.length > 1;

  lines.push('## Drift CI\n');

  // Metrics table (always shown)
  lines.push('| Package | Exports | Coverage | Lint | Status |');
  lines.push('|---------|---------|----------|------|--------|');
  for (const r of results) {
    const cov = r.coveragePass ? `${r.coverage}%` : `${r.coverage}% :x:`;
    const lint = r.lintPass ? `${r.lintIssues}` : `${r.lintIssues} :x:`;
    const status = r.pass ? ':white_check_mark:' : ':x:';
    lines.push(`| ${r.name} | ${r.exports} | ${cov} | ${lint} | ${status} |`);
  }

  // API Changes section
  const apiEntries: string[] = [];
  for (const r of results) {
    if (!r.diff) continue;
    const { breaking, added, changed } = r.diff;
    if (breaking.length === 0 && added.length === 0 && changed.length === 0) continue;
    const pkgLines: string[] = [];
    if (multi) pkgLines.push(`\n**${r.name}**`);
    for (const name of added) pkgLines.push(`- :heavy_plus_sign: Added: \`${name}\``);
    for (const name of changed) pkgLines.push(`- :pencil2: Changed: \`${name}\``);
    for (const b of breaking) pkgLines.push(`- :x: Removed: \`${b.name}\``);
    apiEntries.push(pkgLines.join('\n'));
  }
  if (apiEntries.length > 0) {
    const total = results.reduce(
      (s, r) =>
        s + (r.diff ? r.diff.breaking.length + r.diff.added.length + r.diff.changed.length : 0),
      0,
    );
    lines.push('');
    lines.push(`<details>\n<summary>API Changes (${total})</summary>\n`);
    lines.push(apiEntries.join('\n'));
    lines.push('\n</details>');
  }

  // Breaking Changes section
  const breakingEntries: string[] = [];
  for (const r of results) {
    if (!r.diff?.breaking.length) continue;
    const pkgLines: string[] = [];
    if (multi) pkgLines.push(`\n**${r.name}**`);
    for (const b of r.diff.breaking) {
      pkgLines.push(`- \`${b.name}\`${b.reason ? `: ${b.reason}` : ''}`);
    }
    breakingEntries.push(pkgLines.join('\n'));
  }
  if (breakingEntries.length > 0) {
    const total = results.reduce((s, r) => s + (r.diff?.breaking.length ?? 0), 0);
    lines.push('');
    lines.push(`<details>\n<summary>Breaking Changes (${total})</summary>\n`);
    lines.push(breakingEntries.join('\n'));
    lines.push('\n</details>');
  }

  // Undocumented Exports section
  const undocEntries: string[] = [];
  for (const r of results) {
    if (!r.undocumented?.length) continue;
    const pkgLines: string[] = [];
    if (multi) pkgLines.push(`\n**${r.name}**`);
    for (const name of r.undocumented) pkgLines.push(`- \`${name}\``);
    undocEntries.push(pkgLines.join('\n'));
  }
  if (undocEntries.length > 0) {
    const total = results.reduce((s, r) => s + (r.undocumented?.length ?? 0), 0);
    lines.push('');
    lines.push(`<details>\n<summary>Undocumented Exports (${total})</summary>\n`);
    lines.push(undocEntries.join('\n'));
    lines.push('\n</details>');
  }

  // Footer
  lines.push('');
  lines.push('---');
  const ts = new Date().toISOString();
  const sha = commit ?? '';
  lines.push(`*[Drift](https://github.com/ryanwaits/drift) · ${ts}${sha ? ` · ${sha}` : ''}*`);

  return lines.join('\n');
}

export function registerCiCommand(program: Command): void {
  program
    .command('ci')
    .description('Run CI checks on changed packages')
    .option('--all', 'Check all packages, not just changed ones')
    .option('--private', 'Include private packages')
    .option('--min <number>', 'Minimum coverage percentage (0-100)')
    .action(async (options: { all?: boolean; private?: boolean; min?: string }) => {
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

        let minThreshold = options.min ? Number(options.min) : (config.coverage?.min ?? 0);
        if (minThreshold > 0 && config.coverage?.ratchet) {
          const ratchet = computeRatchetMin(minThreshold);
          minThreshold = ratchet.effectiveMin;
        }
        const results: PackageResult[] = [];
        const skipped: string[] = [];
        const commit = gh.sha?.slice(0, 7) ?? getCommitSha();

        for (const dir of packageDirs) {
          const absDir = dir === '.' ? cwd : path.join(cwd, dir);
          if (!existsSync(absDir)) continue;

          // Read package name + private field
          let name = dir;
          let isPrivate = false;
          const pkgPath = path.join(absDir, 'package.json');
          if (existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
              if (pkg.name) name = pkg.name;
              if (pkg.private === true) isPrivate = true;
            } catch {}
          }

          // Skip private packages unless --private flag
          if (isPrivate && !options.private) {
            skipped.push(name);
            continue;
          }

          let entryFile: string;
          try {
            entryFile = detectEntry(absDir);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (
              message.includes('Could not detect entry point') ||
              message.includes('Monorepo detected')
            ) {
              skipped.push(`${name} (no detectable entry)`);
              continue;
            }

            results.push({
              name,
              coverage: 0,
              coveragePass: false,
              lintIssues: 0,
              lintPass: true,
              exports: 0,
              pass: false,
            });
            continue;
          }

          try {
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

            // Diff / breaking / undocumented (PR context only)
            let diff: PackageResult['diff'];
            let undocumented: PackageResult['undocumented'];

            if (gh.isPR && gh.baseRef) {
              try {
                const relEntry = path.relative(cwd, entryFile);
                const oldSpec = await extractSpecFromRef(`origin/${gh.baseRef}`, relEntry, cwd);
                const diffResult = diffSpec(oldSpec, spec);
                const breaking = categorizeBreakingChanges(diffResult.breaking, oldSpec, spec);
                diff = {
                  breaking: breaking.map((b) => ({ name: b.name, reason: b.reason })),
                  added: diffResult.nonBreaking,
                  changed: diffResult.docsOnly,
                };
              } catch {
                // Entry doesn't exist at base ref (new package) — skip diff
              }

              const undoc = exports
                .filter((e: { description?: string }) => !e.description?.trim())
                .map((e: { name: string }) => e.name);
              if (undoc.length > 0) undocumented = undoc;
            }

            results.push({
              name,
              coverage,
              coveragePass,
              lintIssues,
              lintPass,
              exports: total,
              pass: coveragePass && lintPass,
              diff,
              undocumented,
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

        // Write context.md to ~/.drift/projects/<slug>/
        try {
          writeContext(cwd, {
            packages: results.map((r) => ({
              name: r.name,
              coverage: r.coverage,
              lintIssues: r.lintIssues,
              exports: r.exports,
            })),
            history: readHistory(cwd),
            config,
            commit: commit ?? null,
          });
        } catch {}

        // PR comment / step summary (13.2)
        if (gh.isPR && gh.token && gh.repository) {
          const md = buildPRComment(results, allPass, commit);
          writeStepSummary(md);
          const prNumber = getPRNumber(gh.eventPath);
          if (prNumber) {
            try {
              await postOrUpdatePRComment(gh.repository, prNumber, gh.token, md);
            } catch {}
          }
        }

        const data = {
          results,
          pass: allPass,
          min: minThreshold,
          ...(skipped.length > 0 ? { skipped } : {}),
        };

        let next: OutputNext | undefined;
        const totalLint = results.reduce((s, r) => s + r.lintIssues, 0);
        const failedPkgs = results.filter((r) => !r.pass);
        if (failedPkgs.length > 0) {
          next = {
            suggested: 'drift scan --all',
            reason: `${failedPkgs.length} package${failedPkgs.length === 1 ? '' : 's'} failed checks`,
          };
        } else if (totalLint > 0) {
          next = {
            suggested: 'drift lint --all',
            reason: `${totalLint} lint issue${totalLint === 1 ? '' : 's'} across packages`,
          };
        }

        formatOutput('ci', data, startTime, version, renderCi, next);

        if (!allPass) process.exitCode = 1;
      } catch (err) {
        formatError('ci', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
