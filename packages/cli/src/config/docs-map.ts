/**
 * Docs-map loader: the committed page→type artifact for key-coverage mode.
 * JSON-only, no code execution. "LLM writes the map, machine runs the map" —
 * this loader is the machine's side of that contract, so validation errors
 * must be precise enough for an agent to self-correct the file it authored.
 */

import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

export type DocsMapAnnotation = 'prose-documented' | 'internal-by-convention' | 'ignore';

export interface DocsMapPage {
  /** Docs page path, relative to the map file's directory */
  page: string;
  /** Additional pages/globs merged into the same corpus (e.g. _snippets/*.mdx) */
  extraPages?: string[];
  /** Spec type whose keys this page documents */
  type: string;
  /** Committed spec file to diff against (relative to map dir) */
  spec?: string;
  /** Entry file to extract the spec from (alternative to `spec`) */
  entry?: string;
  /** Heading regex opening an options section (default /option|config/i) */
  sectionRe?: string;
  /** Internal keys beyond the `_`-prefix convention */
  internal?: string[];
  /** Deprecated override (auto-derived from spec metadata when omitted) */
  deprecated?: string[];
  /** Replacement override: deprecatedKey → replacementKey */
  replacements?: Record<string, string>;
  /** Agent-proposed, human-committed key annotations */
  annotations?: Record<string, DocsMapAnnotation>;
  /** Gap ratchet: fail when user-facing gaps exceed this committed count */
  baselineGaps?: number;
}

export interface DocsMap {
  version: 1;
  pages: DocsMapPage[];
}

export interface LoadedDocsMap {
  map: DocsMap;
  /** Absolute path of the map file (page/spec paths resolve relative to its dir) */
  mapPath: string;
  dir: string;
}

const ANNOTATIONS = new Set(['prose-documented', 'internal-by-convention', 'ignore']);

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function validateDocsMap(
  raw: unknown,
): { ok: true; map: DocsMap } | { ok: false; errors: string[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['Docs map must be a JSON object'] };
  }
  const errors: string[] = [];
  const obj = raw as Record<string, unknown>;

  if (obj.version !== 1) errors.push('"version" must be 1');
  if (!Array.isArray(obj.pages)) {
    errors.push('"pages" must be an array');
    return { ok: false, errors };
  }

  obj.pages.forEach((p, i) => {
    const at = `"pages[${i}]"`;
    if (typeof p !== 'object' || p === null) {
      errors.push(`${at} must be an object`);
      return;
    }
    const page = p as Record<string, unknown>;
    if (typeof page.page !== 'string' || !page.page) errors.push(`${at}.page must be a string`);
    if (typeof page.type !== 'string' || !page.type) errors.push(`${at}.type must be a string`);
    if (page.spec !== undefined && typeof page.spec !== 'string')
      errors.push(`${at}.spec must be a string`);
    if (page.entry !== undefined && typeof page.entry !== 'string')
      errors.push(`${at}.entry must be a string`);
    if (page.spec !== undefined && page.entry !== undefined)
      errors.push(
        `${at} must set at most one of "spec"/"entry" (omit both to use the scan target)`,
      );
    if (page.sectionRe !== undefined) {
      if (typeof page.sectionRe !== 'string') {
        errors.push(`${at}.sectionRe must be a string`);
      } else {
        try {
          new RegExp(page.sectionRe);
        } catch {
          errors.push(`${at}.sectionRe is not a valid regex: ${page.sectionRe}`);
        }
      }
    }
    for (const field of ['extraPages', 'internal', 'deprecated'] as const) {
      if (page[field] !== undefined && !isStringArray(page[field]))
        errors.push(`${at}.${field} must be an array of strings`);
    }
    if (page.replacements !== undefined) {
      const r = page.replacements;
      if (typeof r !== 'object' || r === null || Array.isArray(r)) {
        errors.push(`${at}.replacements must be an object of oldKey → newKey strings`);
      } else if (!Object.values(r).every((v) => typeof v === 'string')) {
        errors.push(`${at}.replacements values must be strings`);
      }
    }
    if (page.annotations !== undefined) {
      const a = page.annotations;
      if (typeof a !== 'object' || a === null || Array.isArray(a)) {
        errors.push(`${at}.annotations must be an object of key → annotation`);
      } else {
        for (const [k, v] of Object.entries(a)) {
          if (typeof v !== 'string' || !ANNOTATIONS.has(v))
            errors.push(
              `${at}.annotations["${k}"] must be one of: ${[...ANNOTATIONS].join(', ')} (got ${JSON.stringify(v)})`,
            );
        }
      }
    }
    if (
      page.baselineGaps !== undefined &&
      (typeof page.baselineGaps !== 'number' ||
        page.baselineGaps < 0 ||
        !Number.isInteger(page.baselineGaps))
    )
      errors.push(`${at}.baselineGaps must be a non-negative integer`);
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, map: obj as unknown as DocsMap };
}

export function loadDocsMap(mapPath: string, cwd = process.cwd()): LoadedDocsMap {
  const absPath = path.resolve(cwd, mapPath);
  if (!existsSync(absPath)) throw new Error(`Docs map not found: ${absPath}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(absPath, 'utf-8'));
  } catch {
    throw new Error(`Invalid JSON in ${absPath}`);
  }
  const result = validateDocsMap(raw);
  if (!result.ok) {
    throw new Error(`Invalid docs map at ${absPath}: ${result.errors.join('; ')}`);
  }
  return { map: result.map, mapPath: absPath, dir: path.dirname(absPath) };
}
