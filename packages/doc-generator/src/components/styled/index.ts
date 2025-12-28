// Styled components - pre-styled with Tailwind v4

// Re-export from @doccov/ui
export { CodeTabs, ImportSection, type CodeTab, type CodeTabsProps, type ImportSectionProps } from '@doccov/ui/api';

// Local components (spec-specific)
export type { APIPageProps } from './APIPage';
export { APIPage } from './APIPage';
export type { ClassPageProps } from './ClassPage';
export { ClassPage } from './ClassPage';
export type { EnumPageProps } from './EnumPage';
export { EnumPage } from './EnumPage';
export type { ExportCardProps } from './ExportCard';
export { ExportCard } from './ExportCard';
export type { ExportIndexPageProps } from './ExportIndexPage';
export { ExportIndexPage } from './ExportIndexPage';
export type { FullAPIReferencePageProps } from './FullAPIReferencePage';
export { FullAPIReferencePage } from './FullAPIReferencePage';
export type { FunctionPageProps } from './FunctionPage';
export { FunctionPage } from './FunctionPage';
export type { InterfacePageProps } from './InterfacePage';
export { InterfacePage } from './InterfacePage';
export type { NestedPropertyItemProps, ParameterItemProps } from './ParameterItem';
export { ParameterItem } from './ParameterItem';
export type { VariablePageProps } from './VariablePage';
export { VariablePage } from './VariablePage';

// Section components (for composing custom layouts)
export {
  ClassSection,
  type ClassSectionProps,
  EnumSection,
  type EnumSectionProps,
  ExportSection,
  type ExportSectionProps,
  FunctionSection,
  type FunctionSectionProps,
  InterfaceSection,
  type InterfaceSectionProps,
  VariableSection,
  type VariableSectionProps,
} from './sections';
