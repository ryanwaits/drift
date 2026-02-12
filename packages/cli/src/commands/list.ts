import * as path from 'node:path';
import { computeDrift } from '@driftdev/sdk';
import { listExports } from '@openpkg-ts/sdk';
import type { Command } from 'commander';
import { cachedExtract } from '../cache/cached-extract';
import { renderBatchList } from '../formatters/batch';
import { renderList } from '../formatters/list';
import { detectEntry } from '../utils/detect-entry';
import { fuzzySearch, looksLikeFilePath } from '../utils/fuzzy';
import { formatError, formatOutput } from '../utils/output';
import { getVersion } from '../utils/version';
import { discoverPackages } from '../utils/workspaces';

interface ListOptions {
  kind?: string;
  undocumented?: boolean;
  drifted?: boolean;
  full?: boolean;
  all?: boolean;
}

export function registerListCommand(program: Command): void {
  program
    .command('list [searchOrEntry]')
    .description('List exports (positional arg = search term or entry file)')
    .option('--kind <kinds>', 'Filter by kind (comma-separated)')
    .option('--undocumented', 'Only exports missing JSDoc')
    .option('--drifted', 'Only exports with stale JSDoc')
    .option('--full', 'Show full list (no truncation)')
    .option('--all', 'Run across all workspace packages')
    .action(async (searchOrEntry: string | undefined, options: ListOptions) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        // --all batch mode
        if (options.all) {
          const packages = discoverPackages(process.cwd());
          if (!packages || packages.length === 0) {
            formatError('list', 'No workspace packages found', startTime, version);
            return;
          }
          const rows: Array<{ name: string; count: number }> = [];
          for (const pkg of packages) {
            const res = await listExports({ entryFile: pkg.entry });
            let filtered = res.exports;
            if (options.undocumented) {
              filtered = filtered.filter(
                (e) => !e.description || e.description.trim().length === 0,
              );
            }
            rows.push({ name: pkg.name, count: filtered.length });
          }
          const filter = options.undocumented ? ('undocumented' as const) : undefined;
          formatOutput('list', { packages: rows, filter }, startTime, version, renderBatchList);
          return;
        }

        let entryFile: string;
        let searchTerm: string | undefined;

        if (searchOrEntry && looksLikeFilePath(searchOrEntry)) {
          entryFile = path.resolve(process.cwd(), searchOrEntry);
        } else if (searchOrEntry) {
          entryFile = detectEntry();
          searchTerm = searchOrEntry;
        } else {
          entryFile = detectEntry();
        }

        const result = await listExports({ entryFile });

        let exports = result.exports.map((e) => ({
          name: e.name,
          kind: e.kind,
          description: e.description,
          ...(e.deprecated ? { deprecated: true } : {}),
        }));

        // --kind filter
        if (options.kind) {
          const kinds = new Set(options.kind.split(',').map((k) => k.trim().toLowerCase()));
          exports = exports.filter((e) => kinds.has(e.kind));
        }

        // --undocumented filter
        if (options.undocumented) {
          exports = exports.filter((e) => !e.description || e.description.trim().length === 0);
        }

        // --drifted filter (requires extraction + lint)
        if (options.drifted) {
          const { spec } = await cachedExtract(entryFile);
          const driftResult = computeDrift(spec);
          const driftedNames = new Set(driftResult.exports.keys());
          exports = exports.filter((e) => driftedNames.has(e.name));
        }

        // Positional search
        if (searchTerm) {
          const matches = fuzzySearch(searchTerm, exports);
          exports = matches.map((m) => exports.find((e) => e.name === m.name)!);
        }

        const filter = options.undocumented
          ? ('undocumented' as const)
          : options.drifted
            ? ('drifted' as const)
            : undefined;

        const data = {
          exports: exports.map((e) => ({
            name: e.name,
            kind: e.kind,
            ...(e.description ? { description: e.description } : {}),
            ...(e.deprecated ? { deprecated: true } : {}),
          })),
          ...(searchTerm ? { search: searchTerm } : {}),
          showAll: !!options.full,
          ...(filter ? { filter } : {}),
        };

        formatOutput('list', data, startTime, version, renderList);
      } catch (err) {
        formatError('list', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
