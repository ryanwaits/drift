/**
 * Validation for Drift configuration (`drift.config.json` / package.json
 * `"drift"`). Hand-written, no runtime deps. Mirrors the CLI's
 * drift.config.schema.json — one config format, validated the same everywhere.
 */
import type { DocsConfig, DriftConfig, ExamplesConfig } from './types';

/** Raw config shape before `normalizeConfig` (lists may be string or string[]). */
export interface DriftConfigInput {
  $schema?: string;
  entry?: string;
  include?: string | string[];
  exclude?: string | string[];
  coverage?: { min?: number };
  docs?: { include?: string | string[]; exclude?: string | string[] };
  /** Example execution policy */
  examples?: { run?: boolean };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringList = (value: unknown): value is string | string[] =>
  typeof value === 'string' ||
  (Array.isArray(value) && value.every((item) => typeof item === 'string'));

const isPercent = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

/** Collects `path must be X` issues; each check returns the value or undefined. */
class Issues {
  readonly list: string[] = [];

  check<T>(
    value: unknown,
    path: string,
    guard: (v: unknown) => v is T,
    expected: string,
  ): T | undefined {
    if (value === undefined) return undefined;
    if (guard(value)) return value;
    this.list.push(`${path} must be ${expected}`);
    return undefined;
  }
}

/** Drop keys whose value is `undefined` so output only carries what was set. */
const compact = <T extends object>(obj: T): T => {
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] === undefined) delete obj[key];
  }
  return obj;
};

/**
 * Parse an unknown value into `DriftConfigInput`. Unknown keys are dropped.
 * Throws an `Error` naming every invalid path, e.g.
 * `drift.config: docs.include must be a string or string[]`.
 */
export function parseDriftConfig(input: unknown): DriftConfigInput {
  if (!isRecord(input)) {
    throw new Error('drift.config: must be an object');
  }
  const issues = new Issues();
  const str = (v: unknown): v is string => typeof v === 'string';
  const bool = (v: unknown): v is boolean => typeof v === 'boolean';

  const out: DriftConfigInput = {
    $schema: issues.check(input.$schema, '$schema', str, 'a string'),
    entry: issues.check(input.entry, 'entry', str, 'a string'),
    include: issues.check(input.include, 'include', isStringList, 'a string or string[]'),
    exclude: issues.check(input.exclude, 'exclude', isStringList, 'a string or string[]'),
  };

  const coverage = issues.check(input.coverage, 'coverage', isRecord, 'an object');
  if (coverage) {
    out.coverage = compact({
      min: issues.check(coverage.min, 'coverage.min', isPercent, 'a number between 0 and 100'),
    });
  }

  const docs = issues.check(input.docs, 'docs', isRecord, 'an object');
  if (docs) {
    out.docs = compact({
      include: issues.check(docs.include, 'docs.include', isStringList, 'a string or string[]'),
      exclude: issues.check(docs.exclude, 'docs.exclude', isStringList, 'a string or string[]'),
    });
  }

  const examples = issues.check(input.examples, 'examples', isRecord, 'an object');
  if (examples) {
    out.examples = compact({
      run: issues.check(examples.run, 'examples.run', bool, 'a boolean'),
    });
  }

  if (issues.list.length > 0) {
    throw new Error(`drift.config: ${issues.list.join('; ')}`);
  }
  return compact(out);
}

/**
 * Validator for `drift.config.json` / package.json `"drift"`.
 * `parse` throws a plain `Error` on invalid input (see `parseDriftConfig`).
 */
export const driftConfigSchema: { parse(input: unknown): DriftConfigInput } = {
  parse: parseDriftConfig,
};

const normalizeList = (value?: string | string[]): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  const list = Array.isArray(value) ? value : [value];
  const normalized = list.map((item) => item.trim()).filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
};

/** Normalize raw config: trim lists, drop empty docs/examples blocks. */
export const normalizeConfig = (input: DriftConfigInput): DriftConfig => {
  const include = normalizeList(input.include);
  const exclude = normalizeList(input.exclude);

  let docs: DocsConfig | undefined;
  if (input.docs) {
    const docsInclude = normalizeList(input.docs.include);
    const docsExclude = normalizeList(input.docs.exclude);
    if (docsInclude || docsExclude) {
      docs = {
        include: docsInclude,
        exclude: docsExclude,
      };
    }
  }

  let examples: ExamplesConfig | undefined;
  if (input.examples && input.examples.run !== undefined) {
    examples = { run: input.examples.run };
  }

  return {
    entry: input.entry,
    include,
    exclude,
    coverage: input.coverage,
    docs,
    examples,
  };
};
