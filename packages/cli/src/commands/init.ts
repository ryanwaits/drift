import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { extract } from '@openpkg-ts/sdk';
import { normalize } from '@openpkg-ts/spec';
import { ensureProjectDir, getGlobalConfigPath, getGlobalDir } from '../config/global';
import { renderInit } from '../formatters/init';
import { detectEntry } from '../utils/detect-entry';
import { formatError, formatOutput } from '../utils/output';
import { detectWorkspaces, resolveGlobs } from '../utils/workspaces';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

interface PackageScan {
  name: string;
  entry: string;
  exports: number;
  coverage: number;
}

async function scanPackage(cwd: string, pkgDir: string): Promise<PackageScan | null> {
  const absDir = path.join(cwd, pkgDir);
  if (!existsSync(absDir)) return null;

  const pkgPath = path.join(absDir, 'package.json');
  let name = pkgDir;
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) name = pkg.name;
    } catch {}
  }

  try {
    const entryFile = detectEntry(absDir);
    const result = await extract({ entryFile });
    const spec = normalize(result.spec);
    const exports = spec.exports ?? [];
    const total = exports.length;
    let documented = 0;
    for (const exp of exports) {
      if (exp.description && exp.description.trim().length > 0) documented++;
    }
    const coverage = total > 0 ? Math.round((documented / total) * 100) : 100;
    return { name, entry: path.relative(cwd, entryFile), exports: total, coverage };
  } catch {
    return null;
  }
}

function generateConfig(packages: PackageScan[]): object {
  const worstCoverage = Math.min(...packages.map((p) => p.coverage));
  const threshold = Math.max(0, Math.floor(worstCoverage) - 5);

  return {
    coverage: { min: threshold },
  };
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Scan project, generate global drift config')
    .option('--project', 'Write to drift.config.json in cwd instead of global config')
    .action(async (opts: { project?: boolean }) => {
      const startTime = Date.now();
      const version = getVersion();
      const cwd = process.cwd();

      try {
        // Detect packages
        const workspaces = detectWorkspaces(cwd);
        const isMonorepo = workspaces !== null;
        const packageDirs = isMonorepo ? resolveGlobs(cwd, workspaces) : ['.'];

        // Scan all packages
        const packages: PackageScan[] = [];
        for (const dir of packageDirs) {
          const result = await scanPackage(cwd, dir);
          if (result) packages.push(result);
        }

        if (packages.length === 0) {
          formatError('init', 'No TypeScript packages found', startTime, version);
          return;
        }

        // Generate config → write to project or global location
        const config = generateConfig(packages);
        const configPath = opts.project
          ? path.resolve(cwd, 'drift.config.json')
          : getGlobalConfigPath();

        if (!opts.project) {
          const globalDir = getGlobalDir();
          if (!existsSync(globalDir)) mkdirSync(globalDir, { recursive: true });
        }
        writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

        // Ensure per-project dir
        ensureProjectDir(cwd);

        const data = {
          packages,
          config,
          configPath,
          ciPath: null,
          isMonorepo,
        };

        formatOutput('init', data, startTime, version, renderInit);
      } catch (err) {
        formatError('init', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
