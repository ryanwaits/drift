/**
 * Type definitions for reports and filtering.
 *
 * @example
 * ```ts
 * import type { DriftReport, FilterOptions } from '@driftdev/sdk/types';
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
  type DriftReport,
  type DriftReportSummary,
  type ExportCoverageData,
  getDiffReportPath,
  getReportPath,
  REPORT_EXTENSIONS,
  REPORT_VERSION,
} from './report';
// Drift-owned input types (for adapter authors)
export type {
  ApiExample,
  ApiExport,
  ApiMember,
  ApiSchema,
  ApiSignature,
  ApiSpec,
  ApiTag,
  ApiType,
} from '../analysis/api-spec';
