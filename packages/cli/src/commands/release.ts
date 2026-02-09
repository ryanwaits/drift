import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { computeDrift } from '@doccov/sdk';
import { cachedExtract } from '../cache/cached-extract';
import { loadConfig } from '../config/loader';
import { renderRelease } from '../formatters/release';
import { detectEntry } from '../utils/detect-entry';
import { formatError, formatOutput } from '../utils/output';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getLastTag(): string | null {
  try {
    return execSync('git describe --tags --abbrev=0 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim() || null;
  } catch {
    return null;
  }
}

function getPackageVersion(cwd: string): string | null {
  const pkgPath = path.join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8')).version ?? null;
  } catch {
    return null;
  }
}

export function registerReleaseCommand(program: Command): void {
  program
    .command('release [entry]')
    .description('Pre-publish documentation audit')
    .action(async (entry?: string) => {
      const startTime = Date.now();
      const version = getVersion();
      const cwd = process.cwd();

      try {
        const { config } = loadConfig();
        const entryFile = entry
          ? path.resolve(cwd, entry)
          : config.entry
            ? path.resolve(cwd, config.entry)
            : detectEntry();

        const { spec } = await cachedExtract(entryFile);

        // Coverage
        const exports = spec.exports ?? [];
        const total = exports.length;
        const undocumented: string[] = [];
        for (const exp of exports) {
          if (!exp.description || exp.description.trim().length === 0) {
            undocumented.push(exp.name);
          }
        }
        const documented = total - undocumented.length;
        const coverage = total > 0 ? Math.round((documented / total) * 100) : 100;
        const minThreshold = config.coverage?.min ?? 0;
        const coveragePass = coverage >= minThreshold;

        // Lint
        const driftResult = computeDrift(spec);
        let lintIssues = 0;
        const lintDetails: Array<{ export: string; issue: string }> = [];
        for (const [exportName, drifts] of driftResult.exports) {
          for (const drift of drifts) {
            lintIssues++;
            lintDetails.push({ export: exportName, issue: drift.issue });
          }
        }
        const lintPass = config.lint === false || lintIssues === 0;

        // Semver sanity (compare against last tag if spec exists)
        let semverWarning: string | null = null;
        const lastTag = getLastTag();
        const pkgVersion = getPackageVersion(cwd);

        const reasons: string[] = [];
        if (!coveragePass) reasons.push(`coverage ${coverage}% below ${minThreshold}%`);
        if (!lintPass) reasons.push(`${lintIssues} lint issue${lintIssues === 1 ? '' : 's'}`);

        const ready = coveragePass && lintPass;

        const data = {
          ready,
          coverage,
          coveragePass,
          lintIssues,
          lintPass,
          total,
          documented,
          undocumented: undocumented.slice(0, 10),
          reasons,
          lastTag,
          pkgVersion,
          semverWarning,
          min: minThreshold,
        };

        formatOutput('release', data, startTime, version, renderRelease);
        if (!ready) process.exitCode = 1;
      } catch (err) {
        formatError('release', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
