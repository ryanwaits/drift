import * as fs from 'node:fs';
import * as path from 'node:path';
import { getExportDrift, type MarkdownDocFile, parseMarkdownFiles } from '@doccov/sdk';
import { type DocCovDrift, type DocCovSpec, DRIFT_CATEGORIES } from '@doccov/spec';
import type { SpecExport } from '@openpkg-ts/spec';
import { glob } from 'glob';
import type { CollectedDrift } from './types';

/**
 * Collect all drift issues from exports using DocCovSpec lookup
 */
export function collectDriftsFromExports(
  exports: SpecExport[],
  doccov: DocCovSpec,
): Array<{ export: SpecExport; drift: DocCovDrift }> {
  const results: Array<{ export: SpecExport; drift: DocCovDrift }> = [];
  for (const exp of exports) {
    for (const drift of getExportDrift(exp, doccov)) {
      results.push({ export: exp, drift });
    }
  }
  return results;
}

/**
 * Group drifts by export
 */
export function groupByExport(
  drifts: Array<{ export: SpecExport; drift: DocCovDrift }>,
): Map<SpecExport, DocCovDrift[]> {
  const map = new Map<SpecExport, DocCovDrift[]>();
  for (const { export: exp, drift } of drifts) {
    const existing = map.get(exp) ?? [];
    existing.push(drift);
    map.set(exp, existing);
  }
  return map;
}

/**
 * Collect drift from exports list using DocCovSpec lookup
 */
export function collectDrift(exports: SpecExport[], doccov: DocCovSpec): CollectedDrift[] {
  const drifts: CollectedDrift[] = [];
  for (const exp of exports) {
    const exportDrifts = getExportDrift(exp, doccov);
    if (exportDrifts.length === 0) {
      continue;
    }

    for (const d of exportDrifts) {
      drifts.push({
        name: exp.name,
        type: d.type,
        issue: d.issue ?? 'Documentation drift detected.',
        suggestion: d.suggestion,
        category: DRIFT_CATEGORIES[d.type],
      });
    }
  }
  return drifts;
}

/**
 * Collect multiple values for an option
 */
export function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Load markdown files from glob patterns
 */
export async function loadMarkdownFiles(
  patterns: string[],
  cwd: string,
): Promise<MarkdownDocFile[]> {
  const files: Array<{ path: string; content: string }> = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern, { nodir: true, cwd });
    for (const filePath of matches) {
      try {
        const fullPath = path.resolve(cwd, filePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({ path: filePath, content });
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return parseMarkdownFiles(files);
}
