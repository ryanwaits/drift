/**
 * Documentation style presets for Drift.
 *
 * Presets define expected documentation patterns that vary by project.
 * Some projects require verbose docs with @param/@returns for every function,
 * while others rely on TypeScript types and only need descriptions.
 */

/**
 * Documentation requirements - what must be present for an export to be considered documented.
 */
export interface DocRequirements {
  /** Require description/summary */
  description: boolean;
  /** Require @param tags for function parameters */
  params: boolean;
  /** Require @returns tag for functions */
  returns: boolean;
  /** Require @example blocks */
  examples: boolean;
  /** Require @since tag */
  since: boolean;
}

/**
 * Style preset names.
 */
export type StylePreset = 'minimal' | 'verbose' | 'types-only';

/**
 * Default requirements (when no preset/custom config provided).
 * Same as 'minimal' - just description required.
 */
export const DEFAULT_REQUIREMENTS: DocRequirements = {
  description: true,
  params: false,
  returns: false,
  examples: false,
  since: false,
};

/**
 * Preset definitions.
 *
 * | Preset     | description | params   | returns  | examples |
 * |------------|-------------|----------|----------|----------|
 * | minimal    | required    | optional | optional | optional |
 * | verbose    | required    | required | required | optional |
 * | types-only | optional    | optional | optional | optional |
 */
export const PRESETS: Record<StylePreset, DocRequirements> = {
  minimal: {
    description: true,
    params: false,
    returns: false,
    examples: false,
    since: false,
  },
  verbose: {
    description: true,
    params: true,
    returns: true,
    examples: false,
    since: false,
  },
  'types-only': {
    description: false,
    params: false,
    returns: false,
    examples: false,
    since: false,
  },
};

/**
 * Resolve documentation requirements from config.
 *
 * @param style - Style preset name
 * @param require - Custom requirements (overrides preset)
 * @returns Resolved requirements
 */
export function resolveRequirements(
  style?: StylePreset,
  require?: Partial<DocRequirements>,
): DocRequirements {
  // Start with preset or default
  const base = style ? PRESETS[style] : DEFAULT_REQUIREMENTS;

  // Apply custom overrides
  if (require) {
    return {
      description: require.description ?? base.description,
      params: require.params ?? base.params,
      returns: require.returns ?? base.returns,
      examples: require.examples ?? base.examples,
      since: require.since ?? base.since,
    };
  }

  return { ...base };
}
