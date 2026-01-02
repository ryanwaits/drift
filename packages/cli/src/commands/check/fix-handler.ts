import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  applyEdits,
  categorizeDrifts,
  createSourceFile,
  type FixSuggestion,
  findJSDocLocation,
  generateFixesForExport,
  type JSDocEdit,
  type JSDocPatch,
  mergeFixes,
  parseJSDocToPatch,
  serializeJSDoc,
} from '@doccov/sdk';
import type { DocCovDrift, DocCovSpec } from '@doccov/spec';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import chalk from 'chalk';
import { collectDriftsFromExports, groupByExport } from './utils';

export interface FixHandlerOptions {
  isPreview: boolean;
  targetDir: string;
}

export interface FixHandlerDeps {
  log: typeof console.log;
  error: typeof console.error;
}

export interface FixResult {
  fixedDriftKeys: Set<string>;
  editsApplied: number;
  filesModified: number;
}

/**
 * Handle --fix / --write: auto-fix drift issues
 */
export async function handleFixes(
  openpkg: OpenPkg,
  doccov: DocCovSpec,
  options: FixHandlerOptions,
  deps: FixHandlerDeps,
): Promise<FixResult> {
  const { isPreview, targetDir } = options;
  const { log, error } = deps;

  const fixedDriftKeys = new Set<string>();
  const allDrifts = collectDriftsFromExports(openpkg.exports ?? [], doccov);

  if (allDrifts.length === 0) {
    return { fixedDriftKeys, editsApplied: 0, filesModified: 0 };
  }

  const { fixable, nonFixable } = categorizeDrifts(allDrifts.map((d) => d.drift));

  if (fixable.length === 0) {
    log(chalk.yellow(`Found ${nonFixable.length} drift issue(s), but none are auto-fixable.`));
    return { fixedDriftKeys, editsApplied: 0, filesModified: 0 };
  }

  log('');
  log(chalk.bold(`Found ${fixable.length} fixable issue(s)`));
  if (nonFixable.length > 0) {
    log(chalk.gray(`(${nonFixable.length} non-fixable issue(s) skipped)`));
  }
  log('');

  // Group by export and generate fixes
  const groupedDrifts = groupByExport(allDrifts.filter((d) => fixable.includes(d.drift)));

  const edits: JSDocEdit[] = [];
  const editsByFile = new Map<
    string,
    Array<{
      export: SpecExport;
      edit: JSDocEdit;
      fixes: FixSuggestion[];
      existingPatch: JSDocPatch;
    }>
  >();

  for (const [exp, drifts] of groupedDrifts) {
    const edit = generateEditForExport(exp, drifts, targetDir, log);
    if (!edit) continue;

    // Track which drifts we're fixing
    for (const drift of drifts) {
      fixedDriftKeys.add(`${exp.name}:${drift.issue}`);
    }

    edits.push(edit.edit);

    // Group for display
    const fileEdits = editsByFile.get(edit.filePath) ?? [];
    fileEdits.push({
      export: exp,
      edit: edit.edit,
      fixes: edit.fixes,
      existingPatch: edit.existingPatch,
    });
    editsByFile.set(edit.filePath, fileEdits);
  }

  if (edits.length === 0) {
    return { fixedDriftKeys, editsApplied: 0, filesModified: 0 };
  }

  if (isPreview) {
    displayPreview(editsByFile, targetDir, log);
    return { fixedDriftKeys, editsApplied: 0, filesModified: 0 };
  }

  // Apply fixes
  const applyResult = await applyEdits(edits);

  if (applyResult.errors.length > 0) {
    for (const err of applyResult.errors) {
      error(chalk.red(`  ${err.file}: ${err.error}`));
    }
  }

  // Show summary of applied fixes
  const totalFixes = Array.from(editsByFile.values()).reduce(
    (sum, fileEdits) => sum + fileEdits.reduce((s, e) => s + e.fixes.length, 0),
    0,
  );
  log('');
  log(chalk.green(`✓ Applied ${totalFixes} fix(es) to ${applyResult.filesModified} file(s)`));

  // List files modified
  for (const [filePath, fileEdits] of editsByFile) {
    const relativePath = path.relative(targetDir, filePath);
    const fixCount = fileEdits.reduce((s, e) => s + e.fixes.length, 0);
    log(chalk.dim(`  ${relativePath} (${fixCount} fixes)`));
  }

  return {
    fixedDriftKeys,
    editsApplied: totalFixes,
    filesModified: applyResult.filesModified,
  };
}

interface GeneratedEdit {
  filePath: string;
  edit: JSDocEdit;
  fixes: FixSuggestion[];
  existingPatch: JSDocPatch;
}

function generateEditForExport(
  exp: SpecExport,
  drifts: DocCovDrift[],
  targetDir: string,
  log: typeof console.log,
): GeneratedEdit | null {
  // Skip if no source location
  if (!exp.source?.file) {
    log(chalk.gray(`  Skipping ${exp.name}: no source location`));
    return null;
  }

  // Skip .d.ts files
  if (exp.source.file.endsWith('.d.ts')) {
    log(chalk.gray(`  Skipping ${exp.name}: declaration file`));
    return null;
  }

  const filePath = path.resolve(targetDir, exp.source.file);

  // Check file exists
  if (!fs.existsSync(filePath)) {
    log(chalk.gray(`  Skipping ${exp.name}: file not found`));
    return null;
  }

  // Find JSDoc location in source file
  const sourceFile = createSourceFile(filePath);
  const location = findJSDocLocation(sourceFile, exp.name, exp.source.line);

  if (!location) {
    log(chalk.gray(`  Skipping ${exp.name}: could not find declaration`));
    return null;
  }

  // Parse existing JSDoc if present
  let existingPatch: JSDocPatch = {};
  if (location.hasExisting && location.existingJSDoc) {
    existingPatch = parseJSDocToPatch(location.existingJSDoc);
  }

  // Generate fixes - drifts are already from DocCovSpec, pass export and drifts directly
  const fixes = generateFixesForExport(exp, existingPatch, drifts);

  if (fixes.length === 0) return null;

  // Merge all fixes into a single patch
  const mergedPatch = mergeFixes(fixes, existingPatch);

  // Serialize the new JSDoc
  const newJSDoc = serializeJSDoc(mergedPatch, location.indent);

  const edit: JSDocEdit = {
    filePath,
    symbolName: exp.name,
    startLine: location.startLine,
    endLine: location.endLine,
    hasExisting: location.hasExisting,
    existingJSDoc: location.existingJSDoc,
    newJSDoc,
    indent: location.indent,
  };

  return { filePath, edit, fixes, existingPatch };
}

function displayPreview(
  editsByFile: Map<
    string,
    Array<{
      export: SpecExport;
      edit: JSDocEdit;
      fixes: FixSuggestion[];
    }>
  >,
  targetDir: string,
  log: typeof console.log,
): void {
  log(chalk.bold('Preview - changes that would be made:'));
  log('');

  for (const [filePath, fileEdits] of editsByFile) {
    const relativePath = path.relative(targetDir, filePath);

    for (const { export: exp, edit, fixes } of fileEdits) {
      log(chalk.cyan(`${relativePath}:${edit.startLine + 1}`));
      log(chalk.bold(`  ${exp.name}`));
      log('');

      // Show unified diff
      if (edit.hasExisting && edit.existingJSDoc) {
        // Show before/after diff
        const oldLines = edit.existingJSDoc.split('\n');
        const newLines = edit.newJSDoc.split('\n');

        // Simple diff: show removed then added
        for (const line of oldLines) {
          log(chalk.red(`  - ${line}`));
        }
        for (const line of newLines) {
          log(chalk.green(`  + ${line}`));
        }
      } else {
        // New JSDoc - just show additions
        const newLines = edit.newJSDoc.split('\n');
        for (const line of newLines) {
          log(chalk.green(`  + ${line}`));
        }
      }

      log('');
      log(chalk.dim(`  Fixes: ${fixes.map((f) => f.description).join(', ')}`));
      log('');
    }
  }

  const totalFixes = Array.from(editsByFile.values()).reduce(
    (sum, fileEdits) => sum + fileEdits.reduce((s, e) => s + e.fixes.length, 0),
    0,
  );
  log(chalk.yellow(`${totalFixes} fix(es) across ${editsByFile.size} file(s) would be applied.`));
  log(chalk.gray('Run with --fix to apply these changes.'));
}
