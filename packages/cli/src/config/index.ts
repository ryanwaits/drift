import type { DocCovConfig, DocCovConfigInput, DocsConfig } from '@driftdev/sdk';

import type { LoadedDriftTsConfig } from './drift-ts-config';
import { DRIFT_CONFIG_FILENAMES, loadDriftTsConfig } from './drift-ts-config';

const defineConfig = (config: DocCovConfigInput): DocCovConfigInput => config;

export { DRIFT_CONFIG_FILENAMES, defineConfig, loadDriftTsConfig };
export type { DocCovConfig, DocCovConfigInput, DocsConfig, LoadedDriftTsConfig };
