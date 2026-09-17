import type { ApiExport } from './api-spec';

/**
 * Sentinel file path emitted by extraction for re-exports whose declaration
 * lives outside the analyzed program (e.g. another workspace package).
 */
export const EXTERNAL_SOURCE_FILE = '<external>';

/**
 * Check if an export is an external re-export — its docs live in another
 * package and never cross the extraction boundary, so it can't be judged
 * documented or undocumented here. Extraction marks these two ways:
 * `source.file === '<external>'`, or `source.package` with no file at all
 * (external-unresolved). A real file path alongside `package` means the
 * declaration WAS resolved (e.g. into node_modules) and counts normally.
 */
export function isExternalExport(exp: Pick<ApiExport, 'source'>): boolean {
  const source = exp.source;
  if (!source) return false;
  if (source.file === EXTERNAL_SOURCE_FILE) return true;
  return source.package != null && source.file == null;
}

/** True if the export has a description or a meaningful JSDoc tag (not `@internal`). */
export function isExportDocumented(exp: ApiExport): boolean {
  if (exp.description && exp.description.trim().length > 0) return true;

  const meaningfulTags = exp.tags?.filter((t) => t.name !== 'internal') ?? [];
  if (meaningfulTags.length > 0) return true;

  return false;
}
