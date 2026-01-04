/**
 * Fix module for automatically repairing documentation drift.
 */

export {
  categorizeDrifts,
  type FixSuggestion,
  type FixType,
  generateFix,
  generateFixesForExport,
  isFixableDrift,
  mergeFixes,
} from './deterministic-fixes';
export {
  type ApplyEditsResult,
  applyEdits,
  applyPatchToJSDoc,
  createSourceFile,
  findJSDocLocation,
  type JSDocEdit,
  type JSDocParam,
  type JSDocPatch,
  type JSDocReturn,
  type JSDocTag,
  parseJSDocToPatch,
  serializeJSDoc,
} from './jsdoc-writer';
export {
  type ApplyForgottenExportResult,
  applyForgottenExportFixes,
  type ForgottenExportFix,
  type GenerateForgottenExportFixesOptions,
  generateForgottenExportFixes,
  groupFixesByFile,
  previewForgottenExportFixes,
} from './forgotten-exports';
