/**
 * Global drift config directory: ~/.drift/
 * Per-project data lives in ~/.drift/projects/<slug>/
 */

import * as os from 'node:os';
import * as path from 'node:path';

/** Root global dir: ~/.drift/ */
export function getGlobalDir(): string {
  return path.join(os.homedir(), '.drift');
}

/** Deterministic slug from absolute path — e.g. "-Users-ryanwaits-Code-projects-drift" */
export function getProjectSlug(cwd = process.cwd()): string {
  const abs = path.resolve(cwd);
  return abs.replace(/\//g, '-').replace(/^-/, '-');
}

/** Per-project dir: ~/.drift/projects/<slug>/ (spec cache) */
export function getProjectDir(cwd = process.cwd()): string {
  return path.join(getGlobalDir(), 'projects', getProjectSlug(cwd));
}
