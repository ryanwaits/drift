import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { extract } from '@openpkg-ts/sdk';
import { diffSpec, categorizeBreakingChanges, normalize } from '@openpkg-ts/spec';
import { renderBatchBreaking } from '../formatters/batch';
import { renderBreaking } from '../formatters/breaking';
import { formatError, formatOutput } from '../utils/output';
import { extractSpecFromRef } from '../utils/git-extract';
import { shouldRenderHuman } from '../utils/render';
import { resolveSpecs } from '../utils/resolve-specs';
import { discoverPackages, filterPublic } from '../utils/workspaces';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function registerBreakingCommand(program: Command): void {
  program
    .command('breaking [old] [new]')
    .description('Detect breaking changes between two specs')
    .option('--base <ref>', 'Git ref for old spec')
    .option('--head <ref>', 'Git ref for new spec (default: working tree)')
    .option('--entry <file>', 'Entry file for git ref extraction')
    .option('--all', 'Run across all workspace packages')
    .option('--private', 'Include private packages in --all mode')
    .action(async (oldPath: string | undefined, newPath: string | undefined, options: { base?: string; head?: string; entry?: string; all?: boolean; private?: boolean }) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        const cwd = process.cwd();

        // Batch mode: --all or auto-detect monorepo with --base
        const allPackages = options.all ? discoverPackages(cwd) : null;
        const autoDetected = !options.all && options.base && !options.entry && !oldPath
          ? discoverPackages(cwd)
          : null;
        const batchPackages = allPackages ?? autoDetected;

        if (batchPackages && batchPackages.length > 0 && options.base) {
          const skipped = options.private ? [] : batchPackages.filter((p) => p.private).map((p) => p.name);
          const packages = options.private ? batchPackages : filterPublic(batchPackages);
          if (packages.length === 0) {
            formatError('breaking', 'No workspace packages found', startTime, version);
            return;
          }

          const rows: Array<{ name: string; breaking: Array<{ name: string; reason?: string; severity?: string }>; count: number }> = [];
          let totalBreaking = 0;

          for (const pkg of packages) {
            const relEntry = path.relative(cwd, pkg.entry);
            const oldSpec = await extractSpecFromRef(options.base, relEntry, cwd);

            let newSpec;
            if (options.head) {
              newSpec = await extractSpecFromRef(options.head, relEntry, cwd);
            } else {
              const result = await extract({ entryFile: pkg.entry });
              newSpec = normalize(result.spec);
            }

            const diff = diffSpec(oldSpec, newSpec);
            const breaking = categorizeBreakingChanges(diff.breaking, oldSpec, newSpec);
            rows.push({ name: pkg.name, breaking, count: breaking.length });
            totalBreaking += breaking.length;
          }

          const data = { packages: rows, aggregate: { count: totalBreaking }, ...(skipped.length > 0 ? { skipped } : {}) };
          formatOutput('breaking', data, startTime, version, renderBatchBreaking);

          if (totalBreaking > 0) {
            if (!shouldRenderHuman()) {
              process.stderr.write(`${totalBreaking} breaking change${totalBreaking === 1 ? '' : 's'} found\n`);
            }
            process.exitCode = 1;
          } else if (!shouldRenderHuman()) {
            process.stderr.write('No breaking changes\n');
          }
          return;
        }

        const args = [oldPath, newPath].filter(Boolean) as string[];
        const { oldSpec, newSpec } = await resolveSpecs({ args, ...options });

        const diff = diffSpec(oldSpec, newSpec);
        const breaking = categorizeBreakingChanges(diff.breaking, oldSpec, newSpec);

        const data = { breaking, count: breaking.length };

        formatOutput('breaking', data, startTime, version, renderBreaking);

        if (breaking.length > 0) {
          if (!shouldRenderHuman()) {
            process.stderr.write(`${breaking.length} breaking change${breaking.length === 1 ? '' : 's'} found\n`);
          }
          process.exitCode = 1;
        } else if (!shouldRenderHuman()) {
          process.stderr.write('No breaking changes\n');
        }
      } catch (err) {
        formatError('breaking', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
