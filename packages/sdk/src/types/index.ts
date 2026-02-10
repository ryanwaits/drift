/**
 * Type definitions for reports and filtering.
 *
 * @example
 * ```ts
 * import type { DocCovReport, FilterOptions } from '@driftdev/sdk/types';
 * ```
 *
 * @module types
 */

export type { FilterSource, ResolvedFilters } from '../filtering/merge';
export { mergeFilters, parseListFlag } from '../filtering/merge';
// Filter types (re-export from filtering module)
export type { FilterOptions, ReleaseTag } from '../filtering/types';
// Report types
export {
  type CoverageSummary,
  type DocCovReport,
  type DriftReport,
  type DriftReportSummary,
  type ExportCoverageData,
  getDiffReportPath,
  getReportPath,
  REPORT_EXTENSIONS,
  REPORT_VERSION,
} from './report';
