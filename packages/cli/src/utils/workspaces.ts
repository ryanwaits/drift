import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { detectEntry } from './detect-entry';

export interface WorkspacePackage {
  name: string;
  dir: string;
  entry: string;
}

/**
 * Read workspace globs from package.json.
 * Supports both `workspaces: [...]` and `workspaces: { packages: [...] }` formats.
 */
export function detectWorkspaces(cwd: string): string[] | null {
  const pkgPath = path.join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (Array.isArray(pkg.workspaces)) return pkg.workspaces;
    if (pkg.workspaces?.packages && Array.isArray(pkg.workspaces.packages)) return pkg.workspaces.packages;
  } catch {}
  return null;
}

/**
 * Expand workspace glob patterns into resolved directory paths.
 */
export function resolveGlobs(cwd: string, patterns: string[]): string[] {
  const dirs: string[] = [];
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const base = pattern.replace(/\/?\*.*$/, '');
      const baseDir = path.join(cwd, base);
      if (existsSync(baseDir)) {
        try {
          for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              dirs.push(path.join(base, entry.name));
            }
          }
        } catch {}
      }
    } else {
      dirs.push(pattern);
    }
  }
  return dirs;
}

/**
 * Discover all workspace packages with detectable TS entry points.
 * Returns null if not a monorepo.
 */
export function discoverPackages(cwd: string): WorkspacePackage[] | null {
  const workspaces = detectWorkspaces(cwd);
  if (!workspaces) return null;

  const dirs = resolveGlobs(cwd, workspaces);
  const packages: WorkspacePackage[] = [];

  for (const dir of dirs) {
    const absDir = path.join(cwd, dir);
    if (!existsSync(absDir)) continue;

    // Read package name
    let name = dir;
    const pkgPath = path.join(absDir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name) name = pkg.name;
      } catch {}
    }

    // Detect entry
    try {
      const entry = detectEntry(absDir);
      packages.push({ name, dir, entry });
    } catch {
      // Skip packages without detectable entry
    }
  }

  return packages;
}
