import type { DocCov } from '@doccov/sdk';
import type { DriftCategory, DriftType } from '@doccov/spec';

export type OutputFormat = 'text' | 'json' | 'markdown';

export interface CheckCommandDependencies {
  createDocCov?: (
    options: ConstructorParameters<typeof DocCov>[0],
  ) => Pick<DocCov, 'analyzeFileWithDiagnostics'>;
  log?: typeof console.log;
  error?: typeof console.error;
}

export type CollectedDrift = {
  name: string;
  type: DriftType;
  issue: string;
  suggestion?: string;
  category: DriftCategory;
};

export type StaleReference = {
  file: string;
  line: number;
  exportName: string;
  context: string;
};
