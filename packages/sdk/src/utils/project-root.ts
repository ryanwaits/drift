/**
 * Project root detection utilities
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Markers that indicate a project root directory
 */
const PROJECT_ROOT_MARKERS = [
  '.git',
  'pnpm-workspace.yaml',
  'pnpm-workspace.yml',
  'lerna.json',
  'nx.json',
  'rush.json',
];

/**
 * Find the project root by walking up from the given directory.
 *
 * Looks for:
 * 1. .git directory
 * 2. pnpm-workspace.yaml
 * 3. package.json with "workspaces" field
 * 4. Other monorepo markers (lerna.json, nx.json, rush.json)
 *
 * Falls back to the original directory if no root is found.
 *
 * @param startDir - Directory to start searching from
 * @returns Absolute path to the project root
 */
export function findProjectRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    // Check for marker files/directories
    for (const marker of PROJECT_ROOT_MARKERS) {
      const markerPath = path.join(dir, marker);
      if (fs.existsSync(markerPath)) {
        return dir;
      }
    }

    // Check for package.json with workspaces
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.workspaces) {
          return dir;
        }
      } catch {
        // Invalid JSON, continue searching
      }
    }

    dir = path.dirname(dir);
  }

  // Fallback to start directory if no root found
  return path.resolve(startDir);
}

/** Override for test isolation */
let _stateDirOverride: string | null = null;

/**
 * Override the state directory (for test isolation).
 * Pass null to reset.
 */
export function _setStateDirOverride(dir: string | null): void {
  _stateDirOverride = dir;
}

/**
 * Get the state directory for a project: ~/.drift/projects/<slug>/
 *
 * Uses the project root to compute a deterministic slug.
 *
 * @param cwd - Current working directory or package directory
 * @returns Absolute path to the project state directory
 */
export function getStateDir(cwd: string): string {
  if (_stateDirOverride) return _stateDirOverride;
  const projectRoot = findProjectRoot(cwd);
  const slug = projectRoot.replace(/\//g, '-').replace(/^-/, '-');
  return path.join(os.homedir(), '.drift', 'projects', slug);
}

/**
 * @deprecated Use getStateDir instead. Will be removed in next major.
 */
export function getDriftdevDir(cwd: string): string {
  return getStateDir(cwd);
}
