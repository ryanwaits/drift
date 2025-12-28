# @openpkg-ts/doc-generator

## 0.6.1

### Patch Changes

- fix: correct pluralization for class/interface slugs (classes not classs)

## 0.6.0

### Minor Changes

- add single-page mode and TOC navigation to FullAPIReferencePage

## 0.5.1

### Patch Changes

- feat: add FullAPIReferencePage and section-based architecture

  - Add FullAPIReferencePage for single-page API reference rendering
  - Add section components (FunctionSection, ClassSection, etc.) for composability
  - Refactor existing page components to use section components

## 0.5.0

### Minor Changes

- Add FullAPIReferencePage component and refactor to section-based architecture

  - New FullAPIReferencePage: single-page API ref with kind filtering
  - New section components: FunctionSection, ClassSection, InterfaceSection, EnumSection, VariableSection, ExportSection
  - Refactored page components to use sections internally (reduces duplication)
  - Export sections from doc-generator and fumadocs-adapter for custom layouts

## 0.4.0

### Minor Changes

- Add Stripe-style API reference components (APIParameterItem, ParameterList, ResponseBlock, APICodePanel, LanguageSelector, APISection) and refactor styled pages to use DocsKit components

### Patch Changes

- Updated dependencies
  - @doccov/ui@0.3.0

## 0.3.4

### Patch Changes

- Use DocsKit code blocks in styled page components, add setup docs for Fumadocs integration

## 0.3.3

### Patch Changes

- chore: bump @doccov/ui dependency with fixed exports
- Updated dependencies
  - @doccov/ui@0.2.3

## 0.3.2

### Patch Changes

- Fix @doccov/ui build - separate entry points to avoid duplicate exports
- Updated dependencies
  - @doccov/ui@0.2.2

## 0.3.1

### Patch Changes

- Publish @doccov/ui and bump dependent packages
- Updated dependencies
  - @doccov/ui@0.2.1

## 0.3.0

### Minor Changes

- Extract shared API components to @doccov/ui package

  - New @doccov/ui/api entry: ParameterItem, TypeBadge, ImportSection, CodeTabs, ExportCard
  - Updated FunctionPage, InterfacePage, ClassPage, ExportIndexPage with improved layouts
  - Added Tailwind v4 theme vars and Stripe-style function page CSS
  - Re-export components through doc-generator and fumadocs-adapter

### Patch Changes

- Updated dependencies
  - @doccov/ui@0.2.0

## 0.2.4

### Patch Changes

- fix: include kind folder in ExportIndexPage card links (e.g., /api/functions/add instead of /api/add)

## 0.2.3

### Patch Changes

- fix: force production JSX runtime in client bundle to prevent jsxDEV errors in Next.js builds

## 0.2.2

### Patch Changes

- Add Fumadocs virtual source and loader plugin for seamless integration

## 0.2.1

### Patch Changes

- fix: export new styled components from react-styled entry

## 0.2.0

### Minor Changes

- feat(doc-generator): add AI SDK-style API reference components

  - Add CodeTabs: tabbed code blocks with copy button
  - Add ExportCard: clickable cards for export index grid
  - Add ExportIndexPage: category-grouped exports grid
  - Add ImportSection: copyable import statement display
  - Add ParameterItem: expandable nested params display
  - Update FunctionPage with improved layout
  - Update APIPage to support index mode
  - Add CSS vars for new components

## 0.1.2

### Patch Changes

- fix: separate server/client builds to prevent node:module error in Turbopack

## 0.1.1

### Patch Changes

- fix @openpkg-ts/spec dependency to use published version

## 0.1.0

### Minor Changes

- Initial release of @openpkg-ts/doc-generator

  - Core API: createDocs(), loadSpec() for loading OpenPkg specs
  - Query utilities: formatSchema(), buildSignatureString(), member filtering and sorting
  - Renderers: Markdown/MDX, HTML, JSON output formats
  - Navigation: Fumadocs, Docusaurus, and generic nav generation
  - Search: Pagefind and Algolia compatible indexes
  - React components: Headless (unstyled) and styled (Tailwind v4) variants
  - CLI: generate, build, dev commands
  - Adapter architecture: Extensible framework integration pattern

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.11.1

## 0.0.1

### Initial Release

- **Core API**: `createDocs()`, `loadSpec()` for loading OpenPkg specs
- **Query utilities**: `formatSchema()`, `buildSignatureString()`, member filtering and sorting
- **Renderers**: Markdown/MDX, HTML, JSON output formats
- **Navigation**: Fumadocs, Docusaurus, and generic nav generation
- **Search**: Pagefind and Algolia compatible indexes
- **React components**: Headless (unstyled) and styled (Tailwind v4) variants
- **CLI**: `generate`, `build`, `dev` commands
- **Adapter architecture**: Extensible framework integration pattern
