/**
 * Fix generation for forgotten exports (types referenced in public API but not exported).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ApiSurfaceResult } from '@driftdev/spec';

/** Fix for a forgotten export */
export interface ForgottenExportFix {
  type: 'forgotten-export';
  typeName: string;
  targetFile: string;
  exportStatement: string;
  insertPosition: 'append' | { afterLine: number };
}

/** Result of applying forgotten export fixes */
export interface ApplyForgottenExportResult {
  filesModified: number;
  fixesApplied: number;
  errors: Array<{ file: string; error: string }>;
}

/** Options for generating fixes */
export interface GenerateForgottenExportFixesOptions {
  /** Base directory for resolving paths */
  baseDir: string;
  /** Entry file for the package */
  entryFile: string;
}

/**
 * Generate fixes for forgotten exports.
 * Groups fixes by target file and generates minimal export statements.
 */
export function generateForgottenExportFixes(
  apiSurface: ApiSurfaceResult,
  options: GenerateForgottenExportFixesOptions,
): ForgottenExportFix[] {
  const { baseDir, entryFile } = options;
  const fixes: ForgottenExportFix[] = [];

  for (const forgotten of apiSurface.forgotten) {
    // Skip external types - can't fix those
    if (forgotten.isExternal) continue;

    // Skip if no fix suggestion
    if (!forgotten.fix) continue;

    // Use entry file as default target if not specified
    const targetFile = forgotten.fix.targetFile
      ? path.resolve(baseDir, forgotten.fix.targetFile)
      : path.resolve(baseDir, entryFile);

    fixes.push({
      type: 'forgotten-export',
      typeName: forgotten.name,
      targetFile,
      exportStatement: forgotten.fix.exportStatement,
      insertPosition: 'append',
    });
  }

  return fixes;
}

/**
 * Group fixes by target file for efficient application.
 */
export function groupFixesByFile(fixes: ForgottenExportFix[]): Map<string, ForgottenExportFix[]> {
  const grouped = new Map<string, ForgottenExportFix[]>();

  for (const fix of fixes) {
    const existing = grouped.get(fix.targetFile) ?? [];
    existing.push(fix);
    grouped.set(fix.targetFile, existing);
  }

  return grouped;
}

/**
 * Apply forgotten export fixes to files.
 * Reads files, finds best insertion points, and applies edits.
 */
export async function applyForgottenExportFixes(
  fixes: ForgottenExportFix[],
): Promise<ApplyForgottenExportResult> {
  const result: ApplyForgottenExportResult = {
    filesModified: 0,
    fixesApplied: 0,
    errors: [],
  };

  const grouped = groupFixesByFile(fixes);

  for (const [filePath, fileFixes] of grouped) {
    try {
      // Check file exists
      if (!fs.existsSync(filePath)) {
        result.errors.push({
          file: filePath,
          error: 'File not found',
        });
        continue;
      }

      // Read current content
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split('\n');

      // Find best insertion point (after last export, or at end)
      const insertLine = findBestInsertionPoint(lines, fileFixes);

      // Generate export statements to insert
      const statements = fileFixes.map((f) => f.exportStatement);

      // Dedupe statements (in case same type referenced multiple ways)
      const uniqueStatements = [...new Set(statements)];

      // Insert statements
      const newContent = insertExportStatements(lines, insertLine, uniqueStatements);

      // Write back
      await fs.promises.writeFile(filePath, newContent, 'utf8');

      result.filesModified++;
      result.fixesApplied += uniqueStatements.length;
    } catch (err) {
      result.errors.push({
        file: filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Find the best line to insert new exports.
 * Prefers: after last re-export, after last export, end of file.
 */
function findBestInsertionPoint(lines: string[], _fixes: ForgottenExportFix[]): number {
  let lastExportLine = -1;
  let lastReExportLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Track re-exports (export { } from or export * from)
    if (line.match(/^export\s+(\*|\{[^}]*\})\s+from\s+['"]/)) {
      lastReExportLine = i;
    }

    // Track any export line
    if (line.startsWith('export ')) {
      lastExportLine = i;
    }
  }

  // Prefer placing after last re-export (keeps re-exports grouped)
  if (lastReExportLine >= 0) {
    return lastReExportLine + 1;
  }

  // Otherwise after last export
  if (lastExportLine >= 0) {
    return lastExportLine + 1;
  }

  // Fallback: end of file
  return lines.length;
}

/**
 * Insert export statements at specified line.
 */
function insertExportStatements(lines: string[], insertLine: number, statements: string[]): string {
  const newLines = [...lines];

  // Add blank line before if needed
  const needsBlankBefore =
    insertLine > 0 &&
    newLines[insertLine - 1]?.trim() !== '' &&
    !newLines[insertLine - 1]?.trim().startsWith('export');

  // Build insertion block
  const insertBlock = statements.join('\n');

  // Insert
  if (needsBlankBefore) {
    newLines.splice(insertLine, 0, '', insertBlock);
  } else {
    newLines.splice(insertLine, 0, insertBlock);
  }

  return newLines.join('\n');
}

/**
 * Preview forgotten export fixes without applying them.
 * Returns a map of file paths to the changes that would be made.
 */
export function previewForgottenExportFixes(
  fixes: ForgottenExportFix[],
): Map<string, { insertLine: number; statements: string[] }> {
  const previews = new Map<string, { insertLine: number; statements: string[] }>();
  const grouped = groupFixesByFile(fixes);

  for (const [filePath, fileFixes] of grouped) {
    try {
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const insertLine = findBestInsertionPoint(lines, fileFixes);
      const statements = [...new Set(fileFixes.map((f) => f.exportStatement))];

      previews.set(filePath, { insertLine, statements });
    } catch {
      // Skip files we can't read
    }
  }

  return previews;
}
