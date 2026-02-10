import * as path from 'node:path';
import { runAnalysis } from './analysis/run-analysis';
import type { OpenPkgSpec } from './analysis/spec-types';
import type { DocCovOptions } from './options';

export async function extractPackageSpec(
  entryFile: string,
  packageDir?: string,
  content?: string,
  options?: DocCovOptions,
): Promise<OpenPkgSpec> {
  const result = await runAnalysis({
    entryFile,
    packageDir,
    content,
    options,
  });

  return result.spec;
}
