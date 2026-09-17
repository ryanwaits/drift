/**
 * Zod validation schema for Drift configuration.
 * Mirrors the CLI's drift.config.json shape (see drift.config.schema.json in
 * @driftdev/cli) — one config format, validated the same everywhere.
 */
import { z } from 'zod';
import type { DocsConfig, DriftConfig } from './types';

const stringList: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString>]> = z.union([
  z.string(),
  z.array(z.string()),
]);

const docsConfigSchema: z.ZodObject<{
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
}> = z.object({
  include: stringList.optional(),
  exclude: stringList.optional(),
});

const coverageConfigSchema: z.ZodObject<{
  min: z.ZodOptional<z.ZodNumber>;
}> = z.object({
  min: z.number().min(0).max(100).optional(),
});

export const driftConfigSchema: z.ZodObject<{
  $schema: z.ZodOptional<z.ZodString>;
  entry: z.ZodOptional<z.ZodString>;
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
  coverage: z.ZodOptional<typeof coverageConfigSchema>;
  docs: z.ZodOptional<typeof docsConfigSchema>;
}> = z.object({
  $schema: z.string().optional(),
  entry: z.string().optional(),
  include: stringList.optional(),
  exclude: stringList.optional(),
  coverage: coverageConfigSchema.optional(),
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
    entry: input.entry,
    include,
    exclude,
    coverage: input.coverage,
    docs,
  };
};
