import { type FilterOptions, mergeFilters, parseListFlag, type ReleaseTag } from '@doccov/sdk';
import chalk from 'chalk';
import type { DocCovConfig } from '../config';

// Re-export from SDK for backwards compatibility
export type { FilterOptions };
export { parseListFlag };

/**
 * Parse visibility flag into ReleaseTag array.
 */
export const parseVisibilityFlag = (value: string | undefined): ReleaseTag[] | undefined => {
  if (!value) return undefined;
  const validTags: ReleaseTag[] = ['public', 'beta', 'alpha', 'internal'];
  const parsed = parseListFlag(value);
  if (!parsed) return undefined;

  const result: ReleaseTag[] = [];
  for (const tag of parsed) {
    const lower = tag.toLowerCase() as ReleaseTag;
    if (validTags.includes(lower)) {
      result.push(lower);
    }
  }
  return result.length > 0 ? result : undefined;
};

/**
 * Resolved filter options with CLI-specific messages.
 */
export interface ResolvedFilterOptions {
  include?: string[];
  exclude?: string[];
  visibility?: ReleaseTag[];
  source?: 'config' | 'cli' | 'combined';
  messages: string[];
}

/**
 * Format a list of values with chalk for CLI output.
 */
const formatList = (label: string, values: string[]): string =>
  `${label}: ${values.map((value) => chalk.cyan(value)).join(', ')}`;

/**
 * Merge filter options from config and CLI with formatted messages.
 * This wraps the SDK's mergeFilters with CLI-specific message formatting.
 */
export const mergeFilterOptions = (
  config: DocCovConfig | null,
  cliOptions: FilterOptions,
): ResolvedFilterOptions => {
  const messages: string[] = [];

  // Build messages for CLI output
  if (config?.include) {
    messages.push(formatList('include filters from config', config.include));
  }
  if (config?.exclude) {
    messages.push(formatList('exclude filters from config', config.exclude));
  }
  if (cliOptions.include) {
    messages.push(formatList('apply include filters from CLI', cliOptions.include));
  }
  if (cliOptions.exclude) {
    messages.push(formatList('apply exclude filters from CLI', cliOptions.exclude));
  }
  if (cliOptions.visibility) {
    messages.push(formatList('apply visibility filter from CLI', cliOptions.visibility));
  }

  // Use SDK merge logic
  const resolved = mergeFilters(config, cliOptions);

  if (!resolved.include && !resolved.exclude && !cliOptions.visibility) {
    return { messages };
  }

  // Map SDK source to CLI source
  const source = resolved.source === 'override' ? 'cli' : resolved.source;

  return {
    include: resolved.include,
    exclude: resolved.exclude,
    visibility: cliOptions.visibility,
    source,
    messages,
  };
};
