/**
 * Filter options merge utilities.
 * Consolidates config and override filters.
 */

import type { DriftConfig } from '../config/types';
import type { FilterOptions } from './types';

/**
 * Source of filter options.
 */
export type FilterSource = 'config' | 'override' | 'combined';

/**
 * Resolved filter options after merging config and overrides.
 */
export interface ResolvedFilters {
  /** Include patterns */
  include?: string[];
  /** Exclude patterns */
  exclude?: string[];
  /** Source of the filters */
  source?: FilterSource;
  /** Whether filters were applied from config */
  fromConfig: boolean;
  /** Whether filters were applied from overrides */
  fromOverride: boolean;
}

/**
 * Remove duplicates from an array.
 */
function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Parse a comma-separated list flag into an array.
 *
 * @param [value] - String or string array from CLI flag
 * @returns Parsed array, or undefined if empty
 *
 * @example
 * ```typescript
 * parseListFlag('a,b,c'); // ['a', 'b', 'c']
 * parseListFlag(['a,b', 'c']); // ['a', 'b', 'c']
 * parseListFlag(undefined); // undefined
 * ```
 */
export function parseListFlag(value?: string | string[]): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const rawItems = Array.isArray(value) ? value : [value];
  const normalized = rawItems
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? unique(normalized) : undefined;
}

/**
 * Merge filter options from config and CLI/API overrides.
 *
 * Merge behavior:
 * - Include: CLI values intersect with config values (narrowing)
 * - Exclude: CLI values are added to config values (expanding)
 *
 * @param config - Configuration (from drift.config.ts)
 * @param overrides - Override filters (from CLI flags or API params)
 * @returns Merged filter options
 *
 * @example
 * ```typescript
 * const config = { include: ['A', 'B', 'C'] };
 * const overrides = { include: ['B', 'C', 'D'] };
 *
 * const resolved = mergeFilters(config, overrides);
 * // resolved.include = ['B', 'C'] (intersection)
 * ```
 */
export function mergeFilters(
  config: DriftConfig | null,
  overrides: FilterOptions,
): ResolvedFilters {
  const configInclude = config?.include;
  const configExclude = config?.exclude;
  const overrideInclude = overrides.include;
  const overrideExclude = overrides.exclude;

  let include: string[] | undefined = configInclude;
  let exclude: string[] | undefined = configExclude;
  let source: FilterSource | undefined = include || exclude ? 'config' : undefined;

  const fromConfig = !!(configInclude || configExclude);
  let fromOverride = false;

  // Include: intersection (narrowing)
  if (overrideInclude) {
    include = include ? include.filter((item) => overrideInclude.includes(item)) : overrideInclude;
    source = source ? 'combined' : 'override';
    fromOverride = true;
  }

  // Exclude: union (expanding)
  if (overrideExclude) {
    exclude = exclude ? unique([...exclude, ...overrideExclude]) : overrideExclude;
    source = source ? 'combined' : 'override';
    fromOverride = true;
  }

  include = include ? unique(include) : undefined;
  exclude = exclude ? unique(exclude) : undefined;

  return {
    include,
    exclude,
    source,
    fromConfig,
    fromOverride,
  };
}
