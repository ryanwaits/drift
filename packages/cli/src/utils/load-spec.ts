/**
 * Shared truth-source loader: any supported surface → ApiSpec.
 *
 * Language inference (explicit --lang always wins):
 *   --spec present            → openapi
 *   --abi present or *.clar   → clarity
 *   otherwise                 → typescript
 */
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fromSource } from '@driftdev/clarity-adapter';
import { fromDocument } from '@driftdev/openapi-adapter';
import type { ApiSpec } from '@driftdev/sdk/types';
import { cachedExtract } from '../cache/cached-extract';
import { formatWarning } from './output';

export type SupportedLang = 'typescript' | 'clarity' | 'openapi';

export interface TruthOptions {
  /** Entry file (TS entry, .clar source); unused for openapi. */
  entry?: string;
  /** Explicit language override. */
  lang?: string;
  /** OpenAPI document: local path or http(s) URL. */
  spec?: string;
  /** Clarity ABI JSON path. */
  abi?: string;
}

export interface TruthResult {
  apiSpec: ApiSpec;
  packageName?: string;
  packageVersion?: string;
  lang: SupportedLang;
}

export function getPackageInfo(cwd: string): { name?: string; version?: string } {
  const pkgPath = path.join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return {};
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return { name: pkg.name, version: pkg.version };
  } catch (err) {
    formatWarning(`Could not parse package.json${err instanceof Error ? `: ${err.message}` : ''}`);
    return {};
  }
}

/** Infer language from flags/extension; explicit lang wins. Throws on unknown --lang. */
export function resolveLang(opts: TruthOptions): SupportedLang {
  if (opts.lang) {
    if (opts.lang !== 'typescript' && opts.lang !== 'clarity' && opts.lang !== 'openapi') {
      throw new Error(`Unknown language: ${opts.lang}`);
    }
    return opts.lang;
  }
  if (opts.spec) return 'openapi';
  if (opts.abi || opts.entry?.endsWith('.clar')) return 'clarity';
  return 'typescript';
}

function isUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

async function readSpecDocument(specPath: string): Promise<string> {
  if (isUrl(specPath)) {
    const res = await fetch(specPath, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok)
      throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText} (${specPath})`);
    return res.text();
  }
  if (!existsSync(specPath)) throw new Error(`Spec file not found: ${specPath}`);
  return readFileSync(specPath, 'utf-8');
}

/**
 * Load a truth source as ApiSpec. TS goes through the cache; clarity/openapi
 * parse fresh each run (cache invalidation is TS-mtime-based by design).
 */
export async function resolveTruth(opts: TruthOptions): Promise<TruthResult> {
  const lang = resolveLang(opts);

  if (lang === 'openapi') {
    if (!opts.spec) throw new Error('--spec is required when --lang openapi');
    const specPath = isUrl(opts.spec) ? opts.spec : path.resolve(process.cwd(), opts.spec);
    const document = await readSpecDocument(specPath);
    const name = isUrl(specPath)
      ? new URL(specPath).pathname
          .split('/')
          .pop()
          ?.replace(/\.[^.]*$/, '') || 'openapi'
      : path.basename(specPath, path.extname(specPath));
    const apiSpec = fromDocument(document);
    if (!apiSpec.meta.name || apiSpec.meta.name === 'openapi') apiSpec.meta.name = name;
    return {
      apiSpec,
      packageName: apiSpec.meta.name,
      packageVersion: apiSpec.meta.version,
      lang,
    };
  }

  if (lang === 'clarity') {
    if (!opts.abi) throw new Error('--abi is required when --lang clarity');
    if (!opts.entry) throw new Error('Entry file required for --lang clarity');
    const entryFile = path.resolve(process.cwd(), opts.entry);
    const abiPath = path.resolve(process.cwd(), opts.abi);
    if (!existsSync(entryFile)) throw new Error(`Source file not found: ${entryFile}`);
    if (!existsSync(abiPath)) throw new Error(`ABI file not found: ${abiPath}`);
    const source = readFileSync(entryFile, 'utf-8');
    const abi = JSON.parse(readFileSync(abiPath, 'utf-8'));
    const name = path.basename(entryFile, path.extname(entryFile));
    const pkg = getPackageInfo(process.cwd());
    const apiSpec = fromSource(source, abi, { name, version: pkg.version });
    return { apiSpec, packageName: pkg.name ?? name, packageVersion: pkg.version, lang };
  }

  // TypeScript (default)
  if (!opts.entry) throw new Error('Entry file required');
  const { spec } = await cachedExtract(opts.entry);
  const pkg = getPackageInfo(process.cwd());
  return {
    apiSpec: spec as unknown as ApiSpec,
    packageName: pkg.name,
    packageVersion: pkg.version,
    lang,
  };
}
