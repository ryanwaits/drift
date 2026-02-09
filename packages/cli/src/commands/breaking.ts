import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { diffSpec, categorizeBreakingChanges } from '@openpkg-ts/spec';
import { renderBreaking } from '../formatters/breaking';
import { formatError, formatOutput } from '../utils/output';
import { shouldRenderHuman } from '../utils/render';
import { resolveSpecs } from '../utils/resolve-specs';

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
    .action(async (oldPath: string | undefined, newPath: string | undefined, options: { base?: string; head?: string; entry?: string }) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
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
