import type { CheckConfig, DocCovConfig, DocCovConfigInput, DocsConfig } from '@doccov/sdk';

import type { LoadedDocCovConfig } from './doccov-config';
import { DOCCOV_CONFIG_FILENAMES, loadDocCovConfig } from './doccov-config';

const defineConfig = (config: DocCovConfigInput): DocCovConfigInput => config;

export { DOCCOV_CONFIG_FILENAMES, defineConfig, loadDocCovConfig };
export type { CheckConfig, DocCovConfig, DocCovConfigInput, DocsConfig, LoadedDocCovConfig };
