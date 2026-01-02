/**
 * Markdown/MDX documentation analysis module
 */

// Analyzer functions
export {
  analyzeDocsImpact,
  findDeprecatedReferences,
  findRemovedReferences,
  getDocumentedExports,
  getUndocumentedExports,
  hasDocsForExport,
} from './analyzer';
// Parser functions
export type { MethodCallInfo } from './ast-extractor';
// Diff with docs impact
export type { DiffWithDocsOptions, SpecDiffWithDocs } from './diff-with-docs';
export {
  diffSpecWithDocs,
  getDocsImpactSummary,
  hasDocsImpact,
} from './diff-with-docs';
// Member diff functions
export type { MemberChange } from './member-diff';
export {
  diffMemberChanges,
  getMemberChangesForClass,
  hasAddedMembers,
  hasRemovedMembers,
} from './member-diff';
export {
  blockReferencesExport,
  extractFunctionCalls,
  extractImports,
  extractMethodCalls,
  findExportReferences,
  hasInstantiation,
  isExecutableLang,
  parseMarkdownFile,
  parseMarkdownFiles,
} from './parser';
// Types
export type {
  DocsChangeType,
  DocsImpact,
  DocsImpactReference,
  DocsImpactResult,
  ExportReference,
  MarkdownCodeBlock,
  MarkdownDocFile,
  MemberChangeType,
} from './types';
