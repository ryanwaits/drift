import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { filterSpec } from '@openpkg-ts/sdk';
import type { SpecExportKind } from '@openpkg-ts/spec';
import type { Command } from 'commander';
import { renderFilter } from '../formatters/filter';
import { formatError, formatOutput } from '../utils/output';
import { getVersion } from '../utils/version';

export function registerFilterCommand(program: Command): void {
  program
    .command('filter <file>')
    .description('Filter exports in an OpenPkg spec by criteria')
    .option(
      '--kind <kinds>',
      'Filter by kind (comma-separated: function,class,interface,type,enum,variable)',
    )
    .option('--search <term>', 'Search by name or description')
    .option('--tag <tags>', 'Filter by tag name (comma-separated)')
    .option('--deprecated', 'Only deprecated exports')
    .option('--no-deprecated', 'Exclude deprecated exports')
    .action(async (file: string, options) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        const filePath = path.resolve(process.cwd(), file);
        const content = readFileSync(filePath, 'utf-8');
        const spec = JSON.parse(content);

        const criteria: Record<string, unknown> = {};

        if (options.kind) {
          criteria.kinds = options.kind.split(',').map((k: string) => k.trim()) as SpecExportKind[];
        }
        if (options.search) {
          criteria.search = options.search;
        }
        if (options.tag) {
          criteria.tags = options.tag.split(',').map((t: string) => t.trim());
        }
        if (options.deprecated === true) {
          criteria.deprecated = true;
        } else if (options.deprecated === false) {
          criteria.deprecated = false;
        }

        const result = filterSpec(spec, criteria);

        formatOutput(
          'filter',
          { spec: result.spec, matched: result.matched, total: result.total },
          startTime,
          version,
          renderFilter,
        );
      } catch (err) {
        formatError('filter', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
