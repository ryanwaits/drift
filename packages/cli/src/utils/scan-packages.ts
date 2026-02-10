import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { computeDrift } from '@driftdev/sdk';
import { cachedExtract } from '../cache/cached-extract';
import { detectEntry } from './detect-entry';
import { detectWorkspaces, resolveGlobs } from './workspaces';

export interface ScanResult {
  name: string;
  coverage: number;
  lintIssues: number;
  exports: number;
}

function detectPackageDirs(cwd: string): string[] {
  const workspaces = detectWorkspaces(cwd);
  if (!workspaces) return ['.'];
  return resolveGlobs(cwd, workspaces);
}

export function getCommitSha(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

export async function scanAllPackages(cwd: string): Promise<ScanResult[]> {
  const packageDirs = detectPackageDirs(cwd);
  const results: ScanResult[] = [];

  for (const dir of packageDirs) {
    const absDir = dir === '.' ? cwd : path.join(cwd, dir);
    if (!existsSync(absDir)) continue;

    let name = dir;
    const pkgPath = path.join(absDir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name) name = pkg.name;
      } catch {}
    }

    try {
      const entryFile = detectEntry(absDir);
      const { spec } = await cachedExtract(entryFile);

      const exports = spec.exports ?? [];
      const total = exports.length;
      let documented = 0;
      for (const exp of exports) {
        if (exp.description && exp.description.trim().length > 0) documented++;
      }
      const coverage = total > 0 ? Math.round((documented / total) * 100) : 100;

      const driftResult = computeDrift(spec);
      let lintIssues = 0;
      for (const [, drifts] of driftResult.exports) {
        lintIssues += drifts.length;
      }

      results.push({ name, coverage, lintIssues, exports: total });
    } catch {
      results.push({ name, coverage: 0, lintIssues: 0, exports: 0 });
    }
  }

  return results;
}
