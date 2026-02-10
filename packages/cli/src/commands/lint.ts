import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { computeDrift } from '@doccov/sdk';
import { cachedExtract } from '../cache/cached-extract';
import { loadConfig } from '../config/loader';
import { renderBatchLint } from '../formatters/batch';
import { renderLint } from '../formatters/lint';
import { detectEntry } from '../utils/detect-entry';
import { formatError, formatOutput } from '../utils/output';
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

interface LintIssue {
  export: string;
  issue: string;
  location?: string;
}

export function registerLintCommand(program: Command): void {
  program
    .command('lint [entry]')
    .description('Cross-reference JSDoc against code for accuracy issues')
    .option('--all', 'Run across all workspace packages')
    .option('--private', 'Include private packages in --all mode')
    .action(async (entry: string | undefined, options: { all?: boolean; private?: boolean }) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        // --all batch mode
        if (options.all) {
          const allPackages = discoverPackages(process.cwd());
          if (!allPackages || allPackages.length === 0) {
            formatError('lint', 'No workspace packages found', startTime, version);
            return;
          }
          const skipped = options.private ? [] : allPackages.filter((p) => p.private).map((p) => p.name);
          const packages = options.private ? allPackages : filterPublic(allPackages);
          if (packages.length === 0) {
            formatError('lint', 'No workspace packages found', startTime, version);
            return;
          }
          const rows: Array<{ name: string; exports: number; issues: number }> = [];
          let totalIssues = 0;
          for (const pkg of packages) {
            const { spec } = await cachedExtract(pkg.entry);
            const driftResult = computeDrift(spec);
            let issues = 0;
            for (const [, drifts] of driftResult.exports) issues += drifts.length;
            rows.push({ name: pkg.name, exports: (spec.exports ?? []).length, issues });
            totalIssues += issues;
          }
          const data = { packages: rows, aggregate: { count: totalIssues }, ...(skipped.length > 0 ? { skipped } : {}) };
          formatOutput('lint', data, startTime, version, renderBatchLint);
          if (totalIssues > 0) process.exitCode = 1;
          return;
        }

        const { config } = loadConfig();

        // config.lint === false disables lint
        if (config.lint === false) {
          formatOutput('lint', { issues: [], count: 0 }, startTime, version, renderLint);
          return;
        }

        const entryFile = entry
          ? path.resolve(process.cwd(), entry)
          : config.entry
            ? path.resolve(process.cwd(), config.entry)
            : detectEntry();
        const { spec } = await cachedExtract(entryFile);

        const driftResult = computeDrift(spec);
        const issues: LintIssue[] = [];

        for (const [exportName, drifts] of driftResult.exports) {
          for (const drift of drifts) {
            issues.push({
              export: exportName,
              issue: drift.issue,
              ...(drift.target ? { location: drift.target } : {}),
            });
          }
        }

        const data = { issues, count: issues.length };

        formatOutput('lint', data, startTime, version, renderLint);

        if (issues.length > 0) {
          if (!shouldRenderHuman()) {
            process.stderr.write(`${issues.length} issue${issues.length === 1 ? '' : 's'} found\n`);
          }
          process.exitCode = 1;
        } else if (!shouldRenderHuman()) {
          process.stderr.write('No issues found\n');
        }
      } catch (err) {
        formatError('lint', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
