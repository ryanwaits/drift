import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from '@openpkg-ts/sdk';
import { categorizeBreakingChanges, diffSpec, normalize } from '@openpkg-ts/spec';
import type { Command } from 'commander';
import { renderBatchDiff } from '../formatters/batch';
import { renderDiff } from '../formatters/diff';
import { extractSpecFromRef } from '../utils/git-extract';
import { formatError, formatOutput } from '../utils/output';
import { shouldRenderHuman } from '../utils/render';
import { resolveSpecs } from '../utils/resolve-specs';
import { discoverPackages, filterPublic } from '../utils/workspaces';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    return (
      JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8')).version ?? '0.0.0'
    );
  } catch {
    return '0.0.0';
  }
}

export function registerDiffCommand(program: Command): void {
  program
    .command('diff [old] [new]')
    .description('Compare two specs and show what changed')
    .option('--base <ref>', 'Git ref for old spec')
    .option('--head <ref>', 'Git ref for new spec (default: working tree)')
    .option('--entry <file>', 'Entry file for git ref extraction')
    .option('--all', 'Run across all workspace packages')
    .option('--private', 'Include private packages in --all mode')
    .action(
      async (
        oldPath: string | undefined,
        newPath: string | undefined,
        options: { base?: string; head?: string; entry?: string; all?: boolean; private?: boolean },
      ) => {
        const startTime = Date.now();
        const version = getVersion();

        try {
          const cwd = process.cwd();

          // Batch mode: --all or auto-detect monorepo with --base
          const allPackages = options.all ? discoverPackages(cwd) : null;
          const autoDetected =
            !options.all && options.base && !options.entry && !oldPath
              ? discoverPackages(cwd)
              : null;
          const batchPackages = allPackages ?? autoDetected;

          if (batchPackages && batchPackages.length > 0 && options.base) {
            const skipped = options.private
              ? []
              : batchPackages.filter((p) => p.private).map((p) => p.name);
            const packages = options.private ? batchPackages : filterPublic(batchPackages);
            if (packages.length === 0) {
              formatError('diff', 'No workspace packages found', startTime, version);
              return;
            }

            const rows: Array<{ name: string; breaking: number; added: number; changed: number }> =
              [];
            let totalBreaking = 0;
            let totalAdded = 0;
            let totalChanged = 0;

            for (const pkg of packages) {
              const relEntry = path.relative(cwd, pkg.entry);
              const oldSpec = await extractSpecFromRef(options.base, relEntry, cwd);

              const newSpec = options.head
                ? await extractSpecFromRef(options.head, relEntry, cwd)
                : normalize((await extract({ entryFile: pkg.entry })).spec);

              const diff = diffSpec(oldSpec, newSpec);
              rows.push({
                name: pkg.name,
                breaking: diff.breaking.length,
                added: diff.nonBreaking.length,
                changed: diff.docsOnly.length,
              });
              totalBreaking += diff.breaking.length;
              totalAdded += diff.nonBreaking.length;
              totalChanged += diff.docsOnly.length;
            }

            const data = {
              packages: rows,
              aggregate: { breaking: totalBreaking, added: totalAdded, changed: totalChanged },
              ...(skipped.length > 0 ? { skipped } : {}),
            };
            formatOutput('diff', data, startTime, version, renderBatchDiff);

            if (!shouldRenderHuman()) {
              const parts: string[] = [];
              if (totalBreaking > 0) parts.push(`${totalBreaking} breaking`);
              if (totalAdded > 0) parts.push(`${totalAdded} added`);
              if (totalChanged > 0) parts.push(`${totalChanged} changed`);
              process.stderr.write(`${parts.length > 0 ? parts.join(', ') : 'no changes'}\n`);
            }

            if (totalBreaking > 0) process.exitCode = 1;
            return;
          }

          const args = [oldPath, newPath].filter(Boolean) as string[];
          const { oldSpec, newSpec } = await resolveSpecs({ args, ...options });

          const diff = diffSpec(oldSpec, newSpec);
          const breaking = categorizeBreakingChanges(diff.breaking, oldSpec, newSpec);

          const data = {
            breaking,
            added: diff.nonBreaking,
            changed: diff.docsOnly,
            summary: {
              breaking: diff.breaking.length,
              added: diff.nonBreaking.length,
              changed: diff.docsOnly.length,
            },
          };

          formatOutput('diff', data, startTime, version, renderDiff);

          if (!shouldRenderHuman()) {
            const parts: string[] = [];
            if (diff.breaking.length > 0) parts.push(`${diff.breaking.length} breaking`);
            if (diff.nonBreaking.length > 0) parts.push(`${diff.nonBreaking.length} added`);
            if (diff.docsOnly.length > 0) parts.push(`${diff.docsOnly.length} changed`);
            process.stderr.write(`${parts.length > 0 ? parts.join(', ') : 'no changes'}\n`);
          }

          if (diff.breaking.length > 0) process.exitCode = 1;
        } catch (err) {
          formatError('diff', err instanceof Error ? err.message : String(err), startTime, version);
        }
      },
    );
}
