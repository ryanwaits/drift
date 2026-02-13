import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { detectWorkspaces, resolveGlobs } from './workspaces';

/**
 * Auto-detect TypeScript entry point from cwd.
 *
 * Priority:
 * 1. package.json types/typings
 * 2. package.json exports["."] (types/import/require/default)
 * 3. package.json main/module (resolve .js → .ts)
 * 4. package.json bin (resolve dist/bin files to source)
 * 5. Fallback paths: src/index.ts, index.ts, etc.
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

      // 2. exports["."] (types/import/require/default)
      if (pkg.exports && typeof pkg.exports === 'object') {
        const dot = pkg.exports['.'];
        for (const candidate of collectExportCandidates(dot)) {
          const resolved = resolveToSource(cwd, candidate);
          if (resolved) return resolved;
        }
      }

      // 3. main/module
      if (pkg.main && typeof pkg.main === 'string') {
        const resolved = resolveToSource(cwd, pkg.main);
        if (resolved) return resolved;
      }
      if (pkg.module && typeof pkg.module === 'string') {
        const resolved = resolveToSource(cwd, pkg.module);
        if (resolved) return resolved;
      }

      // 4. bin
      for (const binPath of collectBinCandidates(pkg.bin)) {
        const resolved = resolveToSource(cwd, binPath);
        if (resolved) return resolved;
      }
    } catch {
      // Ignore parse errors, fall through to fallbacks
    }
  }

  // 5. Fallback paths
  const fallbacks = [
    'src/index.ts',
    'src/index.tsx',
    'src/main.ts',
    'src/drift.ts',
    'src/cli.ts',
    'index.ts',
    'lib/index.ts',
  ];

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

      // dist/drift.js → src/drift.ts (CLI-style package entrypoints)
      const rest = normalized.replace(new RegExp(`^${outDir}/`), '');
      const fileName = path.basename(rest);
      const stem = fileName
        .replace(/\.d\.[mc]?ts$/, '')
        .replace(/\.[mc]?js$/, '')
        .replace(/\.[mc]?ts$/, '');
      if (stem && stem !== 'index') {
        candidates.push(`src/${stem}.ts`);
      }
    }
  }

  // Extensionless entry paths
  if (!/\.[a-z]+$/i.test(normalized)) {
    candidates.push(`${normalized}.ts`);
    candidates.push(`${normalized}.tsx`);
  }

  for (const c of candidates) {
    // Skip declaration files and non-TypeScript files (.js/.mjs/.cjs passthrough from no-op replacements)
    if (!/\.[mc]?ts$/.test(c) || /\.d\.[mc]?ts$/.test(c)) continue;
    const full = path.join(cwd, c);
    if (existsSync(full)) return full;
  }

  return null;
}

function collectExportCandidates(dotExport: unknown): string[] {
  if (typeof dotExport === 'string') return [dotExport];
  if (!dotExport || typeof dotExport !== 'object') return [];

  const obj = dotExport as Record<string, unknown>;
  const prioritizedKeys = ['types', 'import', 'default', 'require', 'module', 'node'];

  const candidates: string[] = [];
  for (const key of prioritizedKeys) {
    candidates.push(...collectStringValues(obj[key]));
  }
  for (const [key, value] of Object.entries(obj)) {
    if (prioritizedKeys.includes(key)) continue;
    candidates.push(...collectStringValues(value));
  }

  return Array.from(new Set(candidates));
}

function collectBinCandidates(binField: unknown): string[] {
  if (typeof binField === 'string') return [binField];
  if (!binField || typeof binField !== 'object') return [];

  const out: string[] = [];
  for (const value of Object.values(binField as Record<string, unknown>)) {
    if (typeof value === 'string') out.push(value);
  }
  return Array.from(new Set(out));
}

function collectStringValues(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValues(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      collectStringValues(item, depth + 1),
    );
  }
  return [];
}
