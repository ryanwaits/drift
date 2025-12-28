export {
  type AdapterComponents,
  type AdapterRegistry,
  type APIPageComponentProps,
  adapterRegistry,
  type ConfigHelper,
  type ConfigOptions,
  type ConfigValidationResult,
  createAdapterRegistry,
  type DocFrameworkAdapter,
  type ExportPageProps,
  type FileGenerator,
  type GeneratedFile,
  type NavGeneratorOptions,
  type PageGeneratorOptions,
  type SearchGeneratorOptions,
} from './types';

// Spec-to-DocsKit conversion utilities
export {
  buildImportStatement,
  getLanguagesFromExamples,
  specExamplesToCodeExamples,
  specParamToAPIParam,
  specSchemaToAPISchema,
} from './spec-to-docskit';
