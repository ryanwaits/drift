import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { detectWorkspaces, resolveGlobs } from './workspaces';

/**
 * Auto-detect TypeScript entry point from cwd.
 *
 * Priority:
 * 1. package.json types/typings
 * 2. package.json exports["."].types
 * 3. package.json main (resolve .js → .ts)
 * 4. Fallback paths: src/index.ts, index.ts, etc.
 */
export function detectEntry(cwd = process.cwd()): string {
  const pkgPath = path.join(cwd, 'package.json');

  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

      // 1. types/typings
      const typesField = pkg.types || pkg.typings;
      if (typesField && typeof typesField === 'string') {
        const resolved = resolveToSource(cwd, typesField);
        if (resolved) return resolved;
      }

      // 2. exports["."].types
      if (pkg.exports && typeof pkg.exports === 'object') {
        const dot = pkg.exports['.'];
        if (dot && typeof dot === 'object' && 'types' in dot) {
          const t = dot.types;
          if (t && typeof t === 'string') {
            const resolved = resolveToSource(cwd, t);
            if (resolved) return resolved;
          }
        }
      }

      // 3. main
      if (pkg.main && typeof pkg.main === 'string') {
        const resolved = resolveToSource(cwd, pkg.main);
        if (resolved) return resolved;
      }
    } catch {
      // Ignore parse errors, fall through to fallbacks
    }
  }

  // 4. Fallback paths
  const fallbacks = ['src/index.ts', 'src/index.tsx', 'src/main.ts', 'index.ts', 'lib/index.ts'];

  for (const f of fallbacks) {
    const full = path.join(cwd, f);
    if (existsSync(full)) return full;
  }

  // If this is a monorepo root, give a helpful workspace listing
  const workspaces = detectWorkspaces(cwd);
  if (workspaces) {
    const dirs = resolveGlobs(cwd, workspaces);
    const lines = ['Monorepo detected. Use --cwd <pkg> or --all.', '', '  Packages:'];
    for (const dir of dirs) {
      lines.push(`    ${dir}`);
    }
    lines.push(
      '',
      '  Examples:',
      `    drift coverage --cwd ${dirs[0] ?? 'packages/foo'}`,
      '    drift coverage --all',
    );
    throw new Error(lines.join('\n'));
  }

  throw new Error(
    'Could not detect entry point.\n\n  Try: drift list src/index.ts\n    or: cd my-package && drift list',
  );
}

function resolveToSource(cwd: string, filePath: string): string | null {
  const normalized = filePath.replace(/^\.\//, '');

  // Already a .ts/.mts/.cts source (not declaration)
  if (/\.[mc]?ts$/.test(normalized) && !/\.d\.[mc]?ts$/.test(normalized)) {
    const full = path.join(cwd, normalized);
    if (existsSync(full)) return full;
  }

  // Declaration → source, .js → .ts
  const candidates = [
    normalized.replace(/\.d\.ts$/, '.ts'),
    normalized.replace(/\.d\.mts$/, '.mts'),
    normalized.replace(/\.d\.cts$/, '.cts'),
    normalized.replace(/\.js$/, '.ts'),
    normalized.replace(/\.mjs$/, '.mts'),
    normalized.replace(/\.cjs$/, '.cts'),
  ];

  // dist/ → src/ (handles both dist/index.d.ts and dist/src/index.d.ts layouts)
  const outputDirs = ['dist', 'build', 'lib', 'out'];
  for (const outDir of outputDirs) {
    if (normalized.startsWith(`${outDir}/`)) {
      // dist/foo.d.ts → src/foo.ts
      const srcPath = normalized.replace(new RegExp(`^${outDir}/`), 'src/');
      candidates.push(srcPath.replace(/\.js$/, '.ts'));
      candidates.push(srcPath.replace(/\.d\.ts$/, '.ts'));
      // dist/src/foo.d.ts → src/foo.ts (strip duplicate src/)
      if (normalized.startsWith(`${outDir}/src/`)) {
        const stripped = normalized.replace(new RegExp(`^${outDir}/src/`), 'src/');
        candidates.push(stripped.replace(/\.js$/, '.ts'));
        candidates.push(stripped.replace(/\.d\.ts$/, '.ts'));
      }
    }
  }

  for (const c of candidates) {
    // Skip declaration files and non-TypeScript files (.js/.mjs/.cjs passthrough from no-op replacements)
    if (!/\.[mc]?ts$/.test(c) || /\.d\.[mc]?ts$/.test(c)) continue;
    const full = path.join(cwd, c);
    if (existsSync(full)) return full;
  }

  return null;
}
