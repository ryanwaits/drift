import * as path from 'node:path';
import { Drift } from '@driftdev/sdk';
import { normalize, type OpenPkg } from '@openpkg-ts/spec';
import type { Command } from 'commander';
import { cachedExtract } from '../cache/cached-extract';
import { renderExtract } from '../formatters/extract';
import { detectEntry } from '../utils/detect-entry';
import { resolveLang, resolveTruth } from '../utils/load-spec';
import { formatError, formatOutput } from '../utils/output';
import { getVersion } from '../utils/version';
import { discoverPackages, filterPublic } from '../utils/workspaces';

export function registerExtractCommand(program: Command): void {
  program
    .command('extract [entry]')
    .description('Extract API spec from a source of truth (TypeScript, Clarity, OpenAPI)')
    .option('-o, --output <file>', 'Write JSON to file instead of stdout')
    .option('--only <patterns>', 'Include exports matching glob (comma-separated)')
    .option('--ignore <patterns>', 'Exclude exports matching glob (comma-separated)')
    .option('--max-depth <n>', 'Max type resolution depth', '10')
    .option('--all', 'Extract from all workspace packages')
    .option('--private', 'Include private packages in --all mode')
    .option(
      '--lang <language>',
      'Source language (inferred from --spec/--abi/.clar; default typescript)',
    )
    .option('--abi <path>', 'ABI JSON file (required for --lang clarity)')
    .option('--spec <path>', 'OpenAPI document: path or URL (implies --lang openapi)')
    .action(
      async (
        entry: string | undefined,
        options: {
          output?: string;
          only?: string;
          ignore?: string;
          maxDepth?: string;
          all?: boolean;
          private?: boolean;
          lang?: string;
          abi?: string;
          spec?: string;
        },
      ) => {
        const startTime = Date.now();
        const version = getVersion();

        try {
          const lang = resolveLang({
            entry,
            lang: options.lang,
            spec: options.spec,
            abi: options.abi,
          });
          if (lang !== 'typescript') {
            if (options.all || options.only || options.ignore) {
              formatError(
                'extract',
                `--all/--only/--ignore not yet supported for ${lang}`,
                startTime,
                version,
              );
              return;
            }
            const { apiSpec } = await resolveTruth({
              entry,
              lang,
              spec: options.spec,
              abi: options.abi,
            });
            if (options.output) {
              const { writeFileSync } = await import('node:fs');
              writeFileSync(options.output, JSON.stringify(apiSpec, null, 2));
              process.stderr.write(`drift extract: wrote ${options.output}\n`);
            } else {
              formatOutput('extract', apiSpec, startTime, version, renderExtract);
            }
            return;
          }

          // --all batch mode
          if (options.all) {
            const allPackages = discoverPackages(process.cwd());
            if (!allPackages || allPackages.length === 0) {
              formatError('extract', 'No workspace packages found', startTime, version);
              return;
            }
            const skipped = options.private
              ? []
              : allPackages.filter((p) => p.private).map((p) => p.name);
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
            formatOutput(
              'extract',
              { packages: specs, ...(skipped.length > 0 ? { skipped } : {}) },
              startTime,
              version,
            );
            return;
          }

          const entryFile = entry ? path.resolve(process.cwd(), entry) : detectEntry();

          const hasFilters = !!(options.only || options.ignore);
          let spec: OpenPkg;

          if (hasFilters) {
            // Filters change output — skip cache
            const drift = new Drift({
              resolveExternalTypes: true,
              maxDepth: options.maxDepth ? parseInt(options.maxDepth, 10) : 10,
              useCache: false,
            });
            const filters: Record<string, string[] | undefined> = {};
            if (options.only)
              filters.include = options.only.split(',').map((s: string) => s.trim());
            if (options.ignore)
              filters.exclude = options.ignore.split(',').map((s: string) => s.trim());
            const result = await drift.analyzeFileWithDiagnostics(entryFile, { filters });
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
          formatError(
            'extract',
            err instanceof Error ? err.message : String(err),
            startTime,
            version,
          );
        }
      },
    );
}
