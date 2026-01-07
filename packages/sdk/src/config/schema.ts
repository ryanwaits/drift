/**
 * Zod validation schema for DocCov configuration.
 * Used by CLI for config file validation.
 */
import { z } from 'zod';
import type { CheckConfig, DocCovConfig, DocRequirements, DocsConfig } from './types';

const stringList: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, 'many'>]> = z.union([
  z.string(),
  z.array(z.string()),
]);

/**
 * Docs configuration schema
 */
const docsConfigSchema: z.ZodObject<{
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
}> = z.object({
  /** Glob patterns for markdown docs to include */
  include: stringList.optional(),
  /** Glob patterns for markdown docs to exclude */
  exclude: stringList.optional(),
});

/** Example validation mode */
const exampleModeSchema: z.ZodEnum<['presence', 'typecheck', 'run']> = z.enum([
  'presence',
  'typecheck',
  'run',
]);

/** Example validation modes - can be single, array, or comma-separated */
const exampleModesSchema: z.ZodUnion<
  [typeof exampleModeSchema, z.ZodArray<typeof exampleModeSchema>, z.ZodString]
> = z.union([
  exampleModeSchema,
  z.array(exampleModeSchema),
  z.string(), // For comma-separated values like "presence,typecheck"
]);

/**
 * API surface configuration schema.
 */
const apiSurfaceConfigSchema: z.ZodObject<{
  minCompleteness: z.ZodOptional<z.ZodNumber>;
  warnBelow: z.ZodOptional<z.ZodNumber>;
  ignore: z.ZodOptional<z.ZodArray<z.ZodString>>;
}> = z.object({
  /** Minimum completeness percentage to pass (0-100) */
  minCompleteness: z.number().min(0).max(100).optional(),
  /** Warning threshold - warn when below this (0-100) */
  warnBelow: z.number().min(0).max(100).optional(),
  /** Type names to ignore (won't be flagged as forgotten exports) */
  ignore: z.array(z.string()).optional(),
});

/** Documentation style preset */
const stylePresetSchema: z.ZodEnum<['minimal', 'verbose', 'types-only']> = z.enum([
  'minimal',
  'verbose',
  'types-only',
]);

/** Fine-grained documentation requirements */
const docRequirementsSchema: z.ZodObject<{
  description: z.ZodOptional<z.ZodBoolean>;
  params: z.ZodOptional<z.ZodBoolean>;
  returns: z.ZodOptional<z.ZodBoolean>;
  examples: z.ZodOptional<z.ZodBoolean>;
  since: z.ZodOptional<z.ZodBoolean>;
}> = z.object({
  description: z.boolean().optional(),
  params: z.boolean().optional(),
  returns: z.boolean().optional(),
  examples: z.boolean().optional(),
  since: z.boolean().optional(),
});

/**
 * Check command configuration schema.
 */
const checkConfigSchema: z.ZodObject<{
  examples: z.ZodOptional<typeof exampleModesSchema>;
  minHealth: z.ZodOptional<z.ZodNumber>;
  minCoverage: z.ZodOptional<z.ZodNumber>;
  maxDrift: z.ZodOptional<z.ZodNumber>;
  apiSurface: z.ZodOptional<typeof apiSurfaceConfigSchema>;
  style: z.ZodOptional<typeof stylePresetSchema>;
  require: z.ZodOptional<typeof docRequirementsSchema>;
}> = z.object({
  /**
   * Example validation modes: presence | typecheck | run
   * Can be single value, array, or comma-separated string
   */
  examples: exampleModesSchema.optional(),
  /** Minimum health score required (0-100). Unified metric combining coverage + accuracy. */
  minHealth: z.number().min(0).max(100).optional(),
  /** @deprecated Use minHealth instead */
  minCoverage: z.number().min(0).max(100).optional(),
  /** @deprecated Use minHealth instead */
  maxDrift: z.number().min(0).max(100).optional(),
  /** API surface configuration */
  apiSurface: apiSurfaceConfigSchema.optional(),
  /** Documentation style preset */
  style: stylePresetSchema.optional(),
  /** Fine-grained documentation requirements */
  require: docRequirementsSchema.optional(),
});

export const docCovConfigSchema: z.ZodObject<{
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
  plugins: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
  docs: z.ZodOptional<typeof docsConfigSchema>;
  check: z.ZodOptional<typeof checkConfigSchema>;
}> = z.object({
  include: stringList.optional(),
  exclude: stringList.optional(),
  plugins: z.array(z.unknown()).optional(),
  /** Markdown documentation configuration */
  docs: docsConfigSchema.optional(),
  /** Check command configuration */
  check: checkConfigSchema.optional(),
});

export type DocCovConfigInput = z.infer<typeof docCovConfigSchema>;

const normalizeList = (value?: string | string[]): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  const list = Array.isArray(value) ? value : [value];
  const normalized = list.map((item) => item.trim()).filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeConfig = (input: DocCovConfigInput): DocCovConfig => {
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

  let check: CheckConfig | undefined;
  if (input.check) {
    let require: DocRequirements | undefined;
    if (input.check.require) {
      require = {
        description: input.check.require.description,
        params: input.check.require.params,
        returns: input.check.require.returns,
        examples: input.check.require.examples,
        since: input.check.require.since,
      };
    }

    check = {
      examples: input.check.examples,
      minHealth: input.check.minHealth,
      minCoverage: input.check.minCoverage,
      maxDrift: input.check.maxDrift,
      apiSurface: input.check.apiSurface,
      style: input.check.style,
      require,
    };
  }

  return {
    include,
    exclude,
    plugins: input.plugins,
    docs,
    check,
  };
};
