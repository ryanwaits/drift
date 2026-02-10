import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DocCov, NodeFileSystem, resolveTarget } from '@doccov/sdk';
import { normalize, validateSpec } from '@openpkg-ts/spec';
import type { Command } from 'commander';
import { cachedExtract } from '../cache/cached-extract';
import { renderExtract } from '../formatters/extract';
import { detectEntry } from '../utils/detect-entry';
import { formatError, formatOutput } from '../utils/output';
import { discoverPackages, filterPublic } from '../utils/workspaces';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function registerExtractCommand(program: Command): void {
  program
    .command('extract [entry]')
    .description('Extract OpenPkg spec from TypeScript entry file')
    .option('-o, --output <file>', 'Write JSON to file instead of stdout')
    .option('--only <patterns>', 'Include exports matching glob (comma-separated)')
    .option('--ignore <patterns>', 'Exclude exports matching glob (comma-separated)')
    .option('--max-depth <n>', 'Max type resolution depth', '10')
    .option('--all', 'Extract from all workspace packages')
    .option('--private', 'Include private packages in --all mode')
    .action(async (entry: string | undefined, options: { output?: string; only?: string; ignore?: string; maxDepth?: string; all?: boolean; private?: boolean }) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        // --all batch mode
        if (options.all) {
          const allPackages = discoverPackages(process.cwd());
          if (!allPackages || allPackages.length === 0) {
            formatError('extract', 'No workspace packages found', startTime, version);
            return;
          }
          const skipped = options.private ? [] : allPackages.filter((p) => p.private).map((p) => p.name);
          const packages = options.private ? allPackages : filterPublic(allPackages);
          if (packages.length === 0) {
            formatError('extract', 'No workspace packages found', startTime, version);
            return;
          }
          const specs: Array<{ name: string; spec: unknown }> = [];
          for (const pkg of packages) {
            const { spec } = await cachedExtract(pkg.entry);
            specs.push({ name: pkg.name, spec });
          }
          formatOutput('extract', { packages: specs, ...(skipped.length > 0 ? { skipped } : {}) }, startTime, version);
          return;
        }

        const entryFile = entry ? path.resolve(process.cwd(), entry) : detectEntry();

        const hasFilters = !!(options.only || options.ignore);
        let spec: unknown;

        if (hasFilters) {
          // Filters change output — skip cache
          const doccov = new DocCov({
            resolveExternalTypes: true,
            maxDepth: options.maxDepth ? parseInt(options.maxDepth, 10) : 10,
            useCache: false,
          });
          const filters: Record<string, string[] | undefined> = {};
          if (options.only) filters.include = options.only.split(',').map((s: string) => s.trim());
          if (options.ignore) filters.exclude = options.ignore.split(',').map((s: string) => s.trim());
          const result = await doccov.analyzeFileWithDiagnostics(entryFile, { filters });
          if (!result) {
            formatError('extract', 'Failed to extract spec', startTime, version);
            return;
          }
          spec = normalize(result.spec);
        } else {
          const result = await cachedExtract(entryFile);
          spec = result.spec;
        }

        if (options.output) {
          const { writeFileSync } = await import('node:fs');
          writeFileSync(options.output, JSON.stringify(spec, null, 2));
          process.stderr.write(`drift extract: wrote ${options.output}\n`);
        } else {
          formatOutput('extract', spec, startTime, version, renderExtract);
        }
      } catch (err) {
        formatError('extract', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
