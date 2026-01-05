export { renderDiffHtml } from './diff-html';
// Diff report renderers
export { type DiffReportData, renderDiffMarkdown } from './diff-markdown';
export { renderMarkdown } from './markdown';
export { computeStats, type ReportStats, type SignalStats } from './stats';
export {
  ensureReportDir,
  type WriteReportOptions,
  type WriteReportResult,
  type WriteReportsOptions,
  writeReport,
  writeReports,
} from './writer';
