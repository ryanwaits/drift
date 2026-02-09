import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getExport, listExports } from '@openpkg-ts/sdk';
import type { Command } from 'commander';
import { renderGet } from '../formatters/get';
import { detectEntry } from '../utils/detect-entry';
import { fuzzyTop } from '../utils/fuzzy';
import { formatError, formatOutput } from '../utils/output';
import { shouldRenderHuman, c, indent } from '../utils/render';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function registerGetCommand(program: Command): void {
  program
    .command('get <nameOrEntry> [name]')
    .description('Get detailed spec for a single export')
    .action(async (nameOrEntry: string, name?: string) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        let entryFile: string;
        let exportName: string;

        if (name) {
          entryFile = path.resolve(process.cwd(), nameOrEntry);
          exportName = name;
        } else {
          entryFile = detectEntry();
          exportName = nameOrEntry;
        }

        const result = await getExport({ entryFile, exportName });

        if (!result.export) {
          // Fuzzy suggestions
          const listResult = await listExports({ entryFile });
          const suggestions = fuzzyTop(exportName, listResult.exports);

          if (suggestions.length > 0 && shouldRenderHuman()) {
            const lines = [
              '',
              indent(`${c.red('x')} Export "${exportName}" not found.`),
              '',
              indent(c.gray('Similar:')),
            ];
            for (const s of suggestions) {
              lines.push(indent(`  ${s}`));
            }
            lines.push('');
            lines.push(indent(`drift get ${suggestions[0]}`));
            lines.push('');
            process.stdout.write(lines.join('\n'));
            process.exitCode = 1;
          } else if (suggestions.length > 0) {
            formatError('get', `Export '${exportName}' not found. Similar: ${suggestions.join(', ')}`, startTime, version);
          } else {
            formatError('get', `Export '${exportName}' not found`, startTime, version);
          }
          return;
        }

        formatOutput('get', { export: result.export, types: result.types }, startTime, version, renderGet);
      } catch (err) {
        formatError('get', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
