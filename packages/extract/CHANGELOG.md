# @openpkg-ts/extract

## 0.16.1

### Patch Changes

- fix(extract): strip TSDoc hyphen separator from @param/@typeParam descriptions
  feat(sdk): add @throws tag support to JSDoc writer

## 0.16.0

### Minor Changes

- Add API surface completeness analysis for forgotten exports detection

## 0.15.0

### Minor Changes

- Build structured schemas for registered types using buildSchema instead of type strings

## 0.14.5

### Patch Changes

- feat(extract): serialize namespace members into spec output
  feat(sdk): include namespace members in drift export registry

## 0.14.4

### Patch Changes

- Prefer source entry files over .d.ts, warn when using .d.ts (TSDoc comments may be missing)

## 0.14.3

### Patch Changes

- refactor: extract shared CLI utilities to cli-utils package

  - Move progress, spinner, and output formatting utilities to new cli-utils package
  - Update CLI commands to use shared cli-utils (colors, symbols, summary component)
  - Update extract CLI to use shared cli-utils
  - Remove deprecated progress.ts from CLI
  - Remove outdated doc-generator examples
  - Update package READMEs

## 0.14.2

### Patch Changes

- fix(extract): correct package.json exports path (dist/index.js -> dist/src/index.js)

## 0.14.1

### Patch Changes

- Reduce type explosion: add depth limits to recursive type traversal, expand builtin types set, filter generic params from dangling refs

## 0.14.0

### Minor Changes

- Consolidate type extraction logic into @openpkg-ts/extract package. Removes duplicate serializers from SDK, adds rich type schema extraction with class/interface members and generics support.

## 0.13.0

### Minor Changes

- Add rich type schema extraction with generics and structured output

  - registry.ts: Build shallow schemas for types with $refs, anyOf, generics
  - classes.ts: Extract full class structure (constructors, methods, properties, generics)
  - interfaces.ts: Extract interface members with property/method schemas
  - enums.ts: Build proper enum schemas with values
  - schema-builder.ts: Enhanced schema building with generic type params
  - parameters.ts: Updated parameter extraction for richer schemas

## 0.12.0

### Minor Changes

- feat(extract): rich type schema extraction with generics, unions, intersections, and object literals

  - Rewrite schema-builder to produce structured SpecSchema with proper type discrimination
  - Handle generic types with typeArguments ($ref + typeArguments for user types, expanded for builtins)
  - Support union/intersection types with $union/$intersection arrays
  - Expand object literal types with properties schema
  - Extract function signatures with parameters and returnType
  - Handle tuple types with prefixItems
  - Add expandBindingPattern for destructured params with JSDoc description inheritance

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.12.0

## 0.11.4

### Patch Changes

- fix: resolve and register referenced types in openpkg spec

  - Add type registration for function parameters, return types, and variables
  - Support namespace exports (`export * as Foo from './foo'`)
  - Filter out builtins, enum members, and generic type parameters
  - Extract JSDoc from namespace export statements

## 0.11.3

### Patch Changes

- fix: replace workspace:\* with hardcoded versions for npm compatibility

## 0.11.2

### Patch Changes

- Parse @example JSDoc tags into examples array with code and language fields

## 0.11.1

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

- Updated dependencies
  - @openpkg-ts/spec@0.11.1
