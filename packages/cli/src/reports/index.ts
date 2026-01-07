export { renderDiffHtml } from './diff-html';
// Diff report renderers
export { type DiffReportData, renderDiffMarkdown } from './diff-markdown';
// CI-friendly JSON output
export { type CIJsonOptions, type CIJsonReport, formatCIJson } from './json';
export { renderBatchMarkdown, renderMarkdown } from './markdown';
export { computeStats, type ReportStats, type SignalStats } from './stats';
export {
  ensureReportDir,
  type WriteReportOptions,
  type WriteReportResult,
  type WriteReportsOptions,
  writeReport,
  writeReports,
} from './writer';
