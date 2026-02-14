import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { OpenPkgSpec } from '@openpkg-ts/spec';
import { computeDrift } from '@driftdev/sdk';
import type { Command } from 'commander';
import { cachedExtract } from '../cache/cached-extract';
import { loadConfig } from '../config/loader';
import { renderContext } from '../formatters/context';
import {
  type ContextData,
  type PackageContext,
  type PackageIssue,
  type UndocumentedExport,
  renderContextMarkdown,
  writeContext,
} from '../utils/context-writer';
import { detectEntry } from '../utils/detect-entry';
import { readHistory } from '../utils/history';
import { formatError, formatOutput } from '../utils/output';
import { getVersion } from '../utils/version';
import { discoverPackages, filterPublic } from '../utils/workspaces';

function getCommitSha(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

function buildPackageContext(name: string, spec: OpenPkgSpec): PackageContext {
  const exports = spec.exports ?? [];
  let documented = 0;
  const undocumented: string[] = [];
  const undocumentedExports: UndocumentedExport[] = [];

  for (const exp of exports) {
    if (exp.description?.trim()) {
      documented++;
    } else {
      undocumented.push(exp.name);
      undocumentedExports.push({
        name: exp.name,
        kind: exp.kind,
        filePath: exp.source?.file,
        line: exp.source?.line,
      });
    }
  }

  const coverage = exports.length > 0 ? Math.round((documented / exports.length) * 100) : 100;

  const driftResult = computeDrift(spec);
  const issues: PackageIssue[] = [];
  let lintIssues = 0;

  for (const [exportName, drifts] of driftResult.exports) {
    lintIssues += drifts.length;
    const exp = exports.find((e) => e.name === exportName);
    for (const drift of drifts) {
      issues.push({
        export: exportName,
        type: drift.type,
        issue: drift.issue,
        filePath: drift.filePath ?? exp?.source?.file,
        line: drift.line ?? exp?.source?.line,
      });
    }
  }

  return {
    name,
    coverage,
    lintIssues,
    exports: exports.length,
    documented,
    undocumented,
    issues: issues.length > 0 ? issues : undefined,
    undocumentedExports: undocumentedExports.length > 0 ? undocumentedExports : undefined,
  };
}

export function registerContextCommand(program: Command): void {
  program
    .command('context [entry]')
    .description('Generate agent context file with project state')
    .option('--all', 'Include all workspace packages')
    .option('--private', 'Include private packages in --all mode')
    .option('--output <path>', 'Output path (default: ~/.drift/projects/<slug>/context.md)')
    .action(
      async (
        entry: string | undefined,
        options: { all?: boolean; private?: boolean; output?: string },
      ) => {
        const startTime = Date.now();
        const version = getVersion();
        const cwd = process.cwd();

        try {
          const { config } = loadConfig();
          const commit = getCommitSha();
          const history = readHistory(cwd);
          const packages: PackageContext[] = [];

          if (options.all || !entry) {
            const allPackages = discoverPackages(cwd);
            const pkgs =
              allPackages && allPackages.length > 0
                ? options.private
                  ? allPackages
                  : filterPublic(allPackages)
                : null;

            if (pkgs && pkgs.length > 0) {
              for (const pkg of pkgs) {
                try {
                  const { spec } = await cachedExtract(pkg.entry);
                  packages.push(buildPackageContext(pkg.name, spec));
                } catch {
                  packages.push({
                    name: pkg.name,
                    coverage: 0,
                    lintIssues: 0,
                    exports: 0,
                    documented: 0,
                    undocumented: [],
                  });
                }
              }
            } else {
              const entryFile = config.entry ? path.resolve(cwd, config.entry) : detectEntry();
              const { spec } = await cachedExtract(entryFile);
              const pkgJsonPath = path.resolve(cwd, 'package.json');
              let name = path.basename(cwd);
              try {
                name = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')).name ?? name;
              } catch {}
              packages.push(buildPackageContext(name, spec));
            }
          } else {
            const entryFile = path.resolve(cwd, entry);
            const { spec } = await cachedExtract(entryFile);
            const pkgJsonPath = path.resolve(cwd, 'package.json');
            let name = path.basename(cwd);
            try {
              name = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')).name ?? name;
            } catch {}
            packages.push(buildPackageContext(name, spec));
          }

          const contextData: ContextData = { packages, history, config, commit: commit ?? null };

          // Write context file
          if (options.output) {
            const { mkdirSync, writeFileSync } = await import('node:fs');
            const dir = path.dirname(options.output);
            mkdirSync(dir, { recursive: true });
            writeFileSync(options.output, renderContextMarkdown(contextData));
          } else {
            writeContext(cwd, contextData);
          }

          const { getProjectDir } = await import('../config/global');
          const outputPath = options.output ?? path.join(getProjectDir(cwd), 'context.md');
          const data = {
            path: outputPath,
            packages: packages.map((p) => p.name),
            generated: new Date().toISOString(),
          };
          formatOutput('context', data, startTime, version, renderContext);
        } catch (err) {
          formatError(
            'context',
            err instanceof Error ? err.message : String(err),
            startTime,
            version,
          );
        }
      },
    );
}
