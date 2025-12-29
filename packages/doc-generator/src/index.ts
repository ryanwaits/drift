// Core exports

// Re-export spec types for convenience
export type {
  OpenPkg,
  SpecExample,
  SpecExport,
  SpecExportKind,
  SpecMember,
  SpecSchema,
  SpecSignature,
  SpecSignatureParameter,
  SpecTag,
  SpecType,
  SpecTypeKind,
  SpecTypeParameter,
} from '@openpkg-ts/spec';
// Adapter types for framework integrations
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
} from './adapters';
export type { DocsInstance, LoadOptions } from './core/loader';
export { createDocs, loadSpec } from './core/loader';
// Format utilities
export { formatBadges, getMemberBadges } from './core/format';
// Query utilities
export {
  buildSignatureString,
  formatParameters,
  formatReturnType,
  formatSchema,
  formatTypeParameters,
  getMethods,
  getProperties,
  groupByVisibility,
  isMethod,
  isProperty,
  resolveTypeRef,
  sortByName,
} from './core/query';
export type {
  AlgoliaRecord,
  PagefindRecord,
  SearchIndex,
  SearchOptions,
  SearchRecord,
} from './core/search';
// Search index
export {
  toAlgoliaRecords,
  toPagefindRecords,
  toSearchIndex,
  toSearchIndexJSON,
} from './core/search';
export type {
  DocusaurusSidebar,
  DocusaurusSidebarItem,
  ExportMarkdownOptions,
  FumadocsMeta,
  FumadocsMetaItem,
  GenericNav,
  GroupBy,
  HTMLOptions,
  JSONOptions,
  MarkdownOptions,
  NavFormat,
  NavGroup,
  NavItem,
  NavOptions,
  SimplifiedExample,
  SimplifiedExport,
  SimplifiedMember,
  SimplifiedParameter,
  SimplifiedReturn,
  SimplifiedSignature,
  SimplifiedSpec,
} from './render';
// Render functions
export {
  exportToMarkdown,
  toDocusaurusSidebarJS,
  toFumadocsMetaJSON,
  toHTML,
  toJSON,
  toJSONString,
  toMarkdown,
  toNavigation,
} from './render';
