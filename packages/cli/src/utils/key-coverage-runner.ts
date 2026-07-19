/**
 * Runs docs-page key coverage over a loaded docs map: resolves each page's
 * spec + corpus, computes gaps/ghosts/inversions, applies the gate policy.
 *
 * Gate: FAIL any ghost; FAIL user-facing gaps > baselineGaps (ratchet —
 * drift shrinks, never grows); WARN inversions and at-baseline gaps.
 */

import { globSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  computeKeyCoverage,
  DEFAULT_SECTION_RE,
  extractDocumentedKeys,
  type KeyCoverageResult,
} from '@driftdev/sdk';
import type { ApiSpec } from '@driftdev/sdk/types';
import type { DocsMapPage, LoadedDocsMap } from '../config/docs-map';
import type { AnnotatableIssue } from './annotations';
import { resolveTruth } from './load-spec';

export interface PageCoverage {
  page: string;
  type: string;
  baselineGaps: number;
  status: 'pass' | 'warn' | 'fail';
  failures: string[];
  warnings: string[];
  result: KeyCoverageResult;
}

export interface DocsCoverageRun {
  pages: PageCoverage[];
  pass: boolean;
  /** GitHub-annotation-ready findings (errors then warnings) */
  annotations: { errors: AnnotatableIssue[]; warnings: AnnotatableIssue[] };
}

function resolvePages(page: DocsMapPage, dir: string): Array<{ path: string; content: string }> {
  const files = [path.resolve(dir, page.page)];
  for (const pattern of page.extraPages ?? []) {
    for (const match of globSync(pattern, { cwd: dir })) {
      files.push(path.resolve(dir, match as string));
    }
  }
  return files.map((p) => ({ path: p, content: readFileSync(p, 'utf-8') }));
}

async function resolvePageSpec(
  page: DocsMapPage,
  dir: string,
  fallback: ApiSpec | undefined,
): Promise<ApiSpec> {
  if (page.spec) {
    const specPath = path.resolve(dir, page.spec);
    const raw = JSON.parse(readFileSync(specPath, 'utf-8'));
    // Accept a raw spec, or a drift --json envelope ({ok, data})
    const spec = raw && typeof raw === 'object' && 'data' in raw && 'ok' in raw ? raw.data : raw;
    if (!Array.isArray(spec?.exports) && !Array.isArray(spec?.types)) {
      throw new Error(`${page.spec}: not a spec file (no exports/types arrays)`);
    }
    return spec as ApiSpec;
  }
  if (page.entry) {
    const { apiSpec } = await resolveTruth({ entry: path.resolve(dir, page.entry) });
    return apiSpec;
  }
  if (!fallback) {
    throw new Error(
      `page "${page.page}": no "spec"/"entry" in map and no scan target to fall back to`,
    );
  }
  return fallback;
}

export async function runDocsCoverage(
  loaded: LoadedDocsMap,
  fallbackSpec?: ApiSpec,
): Promise<DocsCoverageRun> {
  const pages: PageCoverage[] = [];
  const errors: AnnotatableIssue[] = [];
  const warnings: AnnotatableIssue[] = [];

  for (const page of loaded.map.pages) {
    const spec = await resolvePageSpec(page, loaded.dir, fallbackSpec);
    const corpus = extractDocumentedKeys(
      resolvePages(page, loaded.dir),
      page.sectionRe ? new RegExp(page.sectionRe, 'i') : DEFAULT_SECTION_RE,
    );
    const result = computeKeyCoverage(spec, page.type, corpus, {
      internal: page.internal,
      deprecated: page.deprecated,
      replacements: page.replacements,
      annotations: page.annotations,
    });
    if (!result) {
      throw new Error(`page "${page.page}": type "${page.type}" not found in spec`);
    }

    const baseline = page.baselineGaps ?? 0;
    const failures: string[] = [];
    const pageWarnings: string[] = [];

    for (const ghost of result.ghosts) {
      failures.push(`ghost option \`${ghost.key}\` — documented but not in ${page.type}`);
      const loc = ghost.locations[0];
      errors.push({
        export: ghost.key,
        issue: `ghost option \`${ghost.key}\` — documented but does not exist on ${page.type} (or any spec type)`,
        filePath: loc?.file ?? path.resolve(loaded.dir, page.page),
        line: loc?.line,
      });
    }

    const gapCount = result.counts.gapsUserFacing;
    if (gapCount > baseline) {
      const newGaps = result.gaps.userFacing.slice(0, 10).map((g: { key: string }) => g.key);
      failures.push(
        `${gapCount} undocumented options (baseline ${baseline}) — drift grew: ${newGaps.join(', ')}${gapCount > 10 ? '…' : ''}`,
      );
      errors.push({
        export: page.type,
        issue: `${gapCount} undocumented ${page.type} options (baseline ${baseline})`,
        filePath: path.resolve(loaded.dir, page.page),
      });
    } else if (gapCount > 0) {
      pageWarnings.push(`${gapCount} known undocumented options (baseline ${baseline})`);
    }

    for (const inv of result.inversions) {
      pageWarnings.push(
        `documents deprecated \`${inv.documented}\` but not its replacement \`${inv.replacement}\``,
      );
      warnings.push({
        export: inv.documented,
        issue: `documents deprecated \`${inv.documented}\` but not its replacement \`${inv.replacement}\``,
        filePath: path.resolve(loaded.dir, page.page),
      });
    }

    pages.push({
      page: page.page,
      type: page.type,
      baselineGaps: baseline,
      status: failures.length > 0 ? 'fail' : pageWarnings.length > 0 ? 'warn' : 'pass',
      failures,
      warnings: pageWarnings,
      result,
    });
  }

  return {
    pages,
    pass: pages.every((p) => p.status !== 'fail'),
    annotations: { errors, warnings },
  };
}
