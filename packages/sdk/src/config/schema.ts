/**
 * Zod validation schema for Drift configuration.
 * Used by CLI for config file validation.
 */
import { z } from 'zod';
import type { DocsConfig, DriftConfig } from './types';

const stringList = z.union([
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

export const driftConfigSchema: z.ZodObject<{
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
  docs: z.ZodOptional<typeof docsConfigSchema>;
}> = z.object({
  include: stringList.optional(),
  exclude: stringList.optional(),
  /** Markdown documentation configuration */
  docs: docsConfigSchema.optional(),
});

export type DriftConfigInput = z.infer<typeof driftConfigSchema>;

const normalizeList = (value?: string | string[]): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  const list = Array.isArray(value) ? value : [value];
  const normalized = list.map((item) => item.trim()).filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
};

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

  return {
    include,
    exclude,
    docs,
  };
};
