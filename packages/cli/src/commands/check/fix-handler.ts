import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  applyEdits,
  applyForgottenExportFixes,
  categorizeDrifts,
  createSourceFile,
  type FixSuggestion,
  type ForgottenExportFix,
  findJSDocLocation,
  generateFixesForExport,
  generateForgottenExportFixes,
  type JSDocEdit,
  type JSDocPatch,
  mergeFixes,
  parseJSDocToPatch,
  previewForgottenExportFixes,
  serializeJSDoc,
} from '@doccov/sdk';
import type { DocCovDrift, DocCovSpec } from '@doccov/spec';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import chalk from 'chalk';
import { collectDriftsFromExports, groupByExport } from './utils';

export interface FixHandlerOptions {
  isPreview: boolean;
  targetDir: string;
  entryFile?: string;
}

export interface FixHandlerDeps {
  log: typeof console.log;
  error: typeof console.error;
}

export interface FixResult {
  fixedDriftKeys: Set<string>;
  editsApplied: number;
  filesModified: number;
  forgottenExportsFixed: number;
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
    return { fixedDriftKeys, editsApplied: 0, filesModified: 0, forgottenExportsFixed: 0 };
  }

  const { fixable, nonFixable } = categorizeDrifts(allDrifts.map((d) => d.drift));

  if (fixable.length === 0) {
    log(chalk.yellow(`Found ${nonFixable.length} drift issue(s), but none are auto-fixable.`));
    return { fixedDriftKeys, editsApplied: 0, filesModified: 0, forgottenExportsFixed: 0 };
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
    return { fixedDriftKeys, editsApplied: 0, filesModified: 0, forgottenExportsFixed: 0 };
  }

  if (isPreview) {
    displayPreview(editsByFile, targetDir, log);
    return { fixedDriftKeys, editsApplied: 0, filesModified: 0, forgottenExportsFixed: 0 };
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
    forgottenExportsFixed: 0,
  };
}

/**
 * Handle --fix for forgotten exports (types referenced but not exported)
 */
export async function handleForgottenExportFixes(
  doccov: DocCovSpec,
  options: FixHandlerOptions,
  deps: FixHandlerDeps,
): Promise<{ fixesApplied: number; filesModified: number }> {
  const { isPreview, targetDir, entryFile } = options;
  const { log, error } = deps;

  // Skip if no API surface data or no forgotten exports
  if (!doccov.apiSurface || doccov.apiSurface.forgotten.length === 0) {
    return { fixesApplied: 0, filesModified: 0 };
  }

  // Filter to fixable forgotten exports (non-external with fix suggestions)
  const fixable = doccov.apiSurface.forgotten.filter((f) => !f.isExternal && f.fix);

  if (fixable.length === 0) {
    return { fixesApplied: 0, filesModified: 0 };
  }

  // Generate fixes
  const fixes = generateForgottenExportFixes(doccov.apiSurface, {
    baseDir: targetDir,
    entryFile: entryFile ?? 'src/index.ts',
  });

  if (fixes.length === 0) {
    return { fixesApplied: 0, filesModified: 0 };
  }

  log('');
  log(chalk.bold(`Found ${fixes.length} forgotten export(s) to fix`));

  if (isPreview) {
    displayForgottenExportPreview(fixes, targetDir, log);
    return { fixesApplied: 0, filesModified: 0 };
  }

  // Apply fixes
  const result = await applyForgottenExportFixes(fixes);

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      error(chalk.red(`  ${err.file}: ${err.error}`));
    }
  }

  if (result.fixesApplied > 0) {
    log('');
    log(
      chalk.green(
        `✓ Added ${result.fixesApplied} export(s) to ${result.filesModified} file(s)`,
      ),
    );

    // Show which types were exported
    const grouped = new Map<string, string[]>();
    for (const fix of fixes) {
      const relativePath = path.relative(targetDir, fix.targetFile);
      const types = grouped.get(relativePath) ?? [];
      types.push(fix.typeName);
      grouped.set(relativePath, types);
    }

    for (const [file, types] of grouped) {
      log(chalk.dim(`  ${file}: ${types.join(', ')}`));
    }
  }

  return { fixesApplied: result.fixesApplied, filesModified: result.filesModified };
}

/**
 * Display preview for forgotten export fixes
 */
function displayForgottenExportPreview(
  fixes: ForgottenExportFix[],
  targetDir: string,
  log: typeof console.log,
): void {
  log(chalk.bold('Preview - forgotten exports that would be added:'));
  log('');

  const previews = previewForgottenExportFixes(fixes);

  for (const [filePath, preview] of previews) {
    const relativePath = path.relative(targetDir, filePath);
    log(chalk.cyan(`${relativePath}:${preview.insertLine + 1}`));
    log('');

    for (const stmt of preview.statements) {
      log(chalk.green(`  + ${stmt}`));
    }
    log('');
  }

  log(chalk.yellow(`${fixes.length} export(s) would be added.`));
  log(chalk.gray('Run with --fix to apply these changes.'));
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
