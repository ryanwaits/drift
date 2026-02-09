/**
 * Global drift config directory: ~/.drift/
 * Per-project data lives in ~/.drift/projects/<slug>/
 */

import { existsSync, mkdirSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** Root global dir: ~/.drift/ */
export function getGlobalDir(): string {
  return path.join(os.homedir(), '.drift');
}

/** Deterministic slug from absolute path — e.g. "-Users-ryanwaits-Code-projects-doccov" */
export function getProjectSlug(cwd = process.cwd()): string {
  const abs = path.resolve(cwd);
  return abs.replace(/\//g, '-').replace(/^-/, '-');
}

/** Per-project dir: ~/.drift/projects/<slug>/ */
export function getProjectDir(cwd = process.cwd()): string {
  return path.join(getGlobalDir(), 'projects', getProjectSlug(cwd));
}

/** Ensure per-project dir exists, return its path. */
export function ensureProjectDir(cwd = process.cwd()): string {
  const dir = getProjectDir(cwd);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Path to global config: ~/.drift/config.json */
export function getGlobalConfigPath(): string {
  return path.join(getGlobalDir(), 'config.json');
}
