# @doccov/spec

## 0.35.1

### Patch Changes

- Retry publish under @driftdev scope (0.35.0 version was consumed by failed publish).

## 0.35.0

### Minor Changes

- Publish under @driftdev scope. Rename legacy config files from doccov.config._ to drift.config._, update CI/Action/docs references.

## 0.31.0

### Patch Changes

- add batch analysis mode with glob patterns, cross-module link validation, incremental analysis, and improved drift detection

## 0.27.0

### Minor Changes

- Add unified documentation health score combining completeness + accuracy metrics

## 0.26.0

### Minor Changes

- Add API surface completeness analysis for forgotten exports detection

## 0.24.1

### Patch Changes

- Initial release of @openpkg-ts/doc-generator

  - Core API: createDocs(), loadSpec() for loading OpenPkg specs
  - Query utilities: formatSchema(), buildSignatureString(), member filtering and sorting
  - Renderers: Markdown/MDX, HTML, JSON output formats
  - Navigation: Fumadocs, Docusaurus, and generic nav generation
  - Search: Pagefind and Algolia compatible indexes
  - React components: Headless (unstyled) and styled (Tailwind v4) variants
  - CLI: generate, build, dev commands
  - Adapter architecture: Extensible framework integration pattern

## 0.24.0

### Patch Changes

- Consolidate drift types in SDK, simplify spec package, add source extraction to spec command
