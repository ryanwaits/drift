# @doccov/sdk

## 0.27.2

### Patch Changes

- fix(extract): strip TSDoc hyphen separator from @param/@typeParam descriptions
  feat(sdk): add @throws tag support to JSDoc writer
- Updated dependencies
  - @openpkg-ts/extract@0.16.1

## 0.27.0

### Minor Changes

- Add unified documentation health score combining completeness + accuracy metrics

### Patch Changes

- Updated dependencies
  - @doccov/spec@0.27.0

## 0.26.0

### Minor Changes

- Add API surface completeness analysis for forgotten exports detection

### Patch Changes

- Updated dependencies
  - @doccov/spec@0.26.0
  - @openpkg-ts/extract@0.16.0

## 0.25.12

### Patch Changes

- Updated dependencies
  - @openpkg-ts/extract@0.15.0

## 0.25.11

### Patch Changes

- fix(drift): skip property access names in identifier reference check

## 0.25.10

### Patch Changes

- feat(extract): serialize namespace members into spec output
  feat(sdk): include namespace members in drift export registry
- Updated dependencies
  - @openpkg-ts/extract@0.14.5

## 0.25.9

### Patch Changes

- refactor: extract shared CLI utilities to cli-utils package

  - Move progress, spinner, and output formatting utilities to new cli-utils package
  - Update CLI commands to use shared cli-utils (colors, symbols, summary component)
  - Update extract CLI to use shared cli-utils
  - Remove deprecated progress.ts from CLI
  - Remove outdated doc-generator examples
  - Update package READMEs

- Updated dependencies
  - @openpkg-ts/extract@0.14.3

## 0.25.8

### Patch Changes

- fix(extract): correct package.json exports path (dist/index.js -> dist/src/index.js)
- Updated dependencies
  - @openpkg-ts/extract@0.14.2

## 0.25.7

### Patch Changes

- Bump extract dependency
- Updated dependencies
  - @openpkg-ts/extract@0.14.1

## 0.25.5

### Patch Changes

- Consolidate type extraction logic into @openpkg-ts/extract package. Removes duplicate serializers from SDK, adds rich type schema extraction with class/interface members and generics support.
- Updated dependencies
  - @openpkg-ts/extract@0.14.0

## 0.25.4

### Patch Changes

- Updated dependencies
  - @openpkg-ts/extract@0.13.0

## 0.25.3

### Patch Changes

- fix(sdk): handle generic type references with typeArguments in formatTypeReference

  - Support $ref + typeArguments for user-defined generic types
  - Expand builtin generics (Promise, Map, Set, etc.) with proper typeArguments
  - Add tests for generic type formatting

- Updated dependencies
  - @openpkg-ts/extract@0.12.0
  - @openpkg-ts/spec@0.12.0

## 0.25.2

### Patch Changes

- chore: bump @openpkg-ts/extract dependency
- Updated dependencies
  - @openpkg-ts/extract@0.11.4

## 0.25.1

### Patch Changes

- fix: replace workspace:\* with hardcoded versions for npm compatibility
- Updated dependencies
  - @openpkg-ts/extract@0.11.3

## 0.25.0

### Minor Changes

- Remove unused enrichment/diff code from SDK, delete unused UI components (drift-command-center, fix-workflow, pr-coverage)

## 0.24.2

### Patch Changes

- Updated dependencies
  - @openpkg-ts/extract@0.11.2

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

- Updated dependencies
  - @openpkg-ts/extract@0.11.1
  - @openpkg-ts/spec@0.11.1
  - @doccov/spec@0.24.1

## 0.24.0

### Minor Changes

- Consolidate drift types in SDK, simplify spec package, add source extraction to spec command

### Patch Changes

- Updated dependencies
  - @doccov/spec@0.24.0

## 0.23.0

### Minor Changes

- refactor: modularize api into shared packages with centralized middleware

## 0.22.1

### Patch Changes

- refactor: split api into modular packages (api-shared, auth), move migrations to db

## 0.22.0

### Minor Changes

- Remove deprecated `tsType` field in favor of `schema`, add CLI warning when `--runtime` requested without built code

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.11.0

## 0.21.0

### Minor Changes

- feat: runtime TypeBox schema extraction - detect TypeBox schemas via Kind symbol and use directly as JSON Schema, preserving formats/constraints

## 0.20.0

### Minor Changes

- feat: runtime Standard Schema detection for Zod, Valibot, TypeBox, ArkType

## 0.19.0

### Minor Changes

- feat: hybrid schema extraction for Zod, Valibot, TypeBox, ArkType

  - Static extraction via TypeScript Compiler API (default, no runtime)
  - Runtime extraction via Standard Schema spec (opt-in, richer output)
  - New `--runtime` CLI flag enables hybrid mode
  - Falls back gracefully from runtime to static extraction

## 0.18.0

### Minor Changes

- Enhanced quality rules, filtering, github context, analysis reports, new API routes (ai, billing, demo, github-app, invites, orgs), trends command, diff capabilities

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.10.0

## 0.15.1

### Patch Changes

- Consolidate duplicate FIXABLE_DRIFT_TYPES into single isFixableDrift() source

## 0.15.0

### Minor Changes

- Add SDK test suite with 113 tests, refactor parameter-utils.ts into focused modules (typebox-handler, schema-builder, type-formatter), remove deprecated aliases (OpenPkg, OpenPkgOptions)

## 0.13.0

### Minor Changes

- e063639: refactor: replace scan architecture with plan/execute model

  **@doccov/sdk**

  - Add `fetchGitHubContext()` for fetching repository metadata via GitHub API
  - Add `BuildPlan` types for describing build/analysis execution plans
  - Export new scan types: `BuildPlan`, `BuildPlanStep`, `BuildPlanExecutionResult`, `GitHubProjectContext`
  - Remove legacy scan orchestrator in favor of external execution

  **@doccov/cli**

  - Remove `scan` command (moved to API service)
  - Update `spec` command with improved analysis

  **@openpkg-ts/spec**

  - Add `BuildPlan` and related types to schema
  - Extend spec schema for plan-based analysis

### Patch Changes

- Updated dependencies [e063639]
  - @openpkg-ts/spec@0.9.0

## 0.12.0

### Minor Changes

- ### `diff` command improvements

  **New features:**

  - Hash-based report caching - repeated diffs with same specs are instant
  - `--no-cache` flag to bypass cache and force regeneration
  - `--strict` presets (`ci`, `release`, `quality`) for streamlined CI configuration
  - Support for both positional and explicit `--base`/`--head` arguments
  - `--min-coverage` and `--max-drift` threshold flags (same as `check` command)
  - Config file support for thresholds via `doccov.config.ts`
  - Simplified terminal output with detailed reports written to `.doccov/`

  **SDK additions:**

  - `calculateAggregateCoverage(spec)` - lightweight coverage calculation from exports
  - `ensureSpecCoverage(spec)` - ensures spec has top-level coverage score
  - `getDiffReportPath()` - hash-based diff report path generation

  **Fixes:**

  - Coverage now correctly calculated for raw specs (was showing 0% → 0%)
  - Shared validation utilities extracted to avoid duplication between `check` and `diff`

## 0.11.0

### Minor Changes

- Version sync release

## 0.10.1

### Patch Changes

- Fix path duplication bug in monorepo entry point detection

  When using `--package` flag in a monorepo, the entry point path was being duplicated
  (e.g., `packages/sdk/packages/sdk/src/index.ts` instead of `packages/sdk/src/index.ts`).

  The `detectEntryPoint` function now correctly returns paths relative to the package
  directory rather than including the package path prefix.

## 0.10.0

### Minor Changes

- ### @openpkg-ts/spec

  **Breaking (pre-1.0):** Restructured spec types to move coverage metadata to an enrichment layer:

  - Removed `docs` field from `SpecExport` and `OpenPkg` types (now provided via SDK enrichment)
  - Changed `SpecDocsMetadata.missing` from `SpecDocSignal[]` to `string[]` (now uses rule IDs)
  - Added `DriftType` as a standalone exported type
  - Added `DriftCategory` type with three categories: `structural`, `semantic`, `example`
  - Added `DRIFT_CATEGORIES` mapping, `DRIFT_CATEGORY_LABELS`, and `DRIFT_CATEGORY_DESCRIPTIONS` constants for categorizing and displaying drift issues

  ### @doccov/sdk

  **Breaking (pre-1.0):** Replaced the lint module with a new quality rules engine and added spec-level caching:

  - Removed the `lint` module (`LintConfig`, `LintRule`, `lintExport`, `lintExports`, etc.)
  - Added `quality` module with a flexible rules-based engine:
    - `QualityRule`, `QualityViolation`, `QualityConfig` types
    - `evaluateQuality()`, `evaluateExportQuality()` functions
    - Built-in rules: `CORE_RULES`, `STYLE_RULES`, `BUILTIN_RULES`
  - Added `cache` module for spec-level caching:
    - `loadSpecCache()`, `saveSpecCache()`, `validateSpecCache()`
    - `hashFile()`, `hashFiles()`, `hashString()` utilities
  - Added enrichment layer:
    - `enrichSpec()` function
    - `EnrichedExport`, `EnrichedOpenPkg`, `EnrichedDocsMetadata` types
  - Added unified report generation:
    - `generateReport()`, `generateReportFromEnriched()`
    - `DocCovReport`, `CoverageSummary`, `DriftReport` types
  - Added unified example validation:
    - `validateExamples()` function
    - `parseExamplesFlag()`, `shouldValidate()` utilities
    - `ExampleValidationResult`, `ExampleValidationOptions` types

  ### @doccov/cli

  **Breaking (pre-1.0):** Revamped commands for better UX and added multi-format reporting:

  - Renamed `generate` command to `spec` (generates OpenPkg spec files)
  - Added `info` command for quick package summary (exports, coverage, drift at a glance)
  - Revamped `check` command:
    - Removed options: `--require-examples`, `--exec`, `--no-lint`, `--no-typecheck`, `--ignore-drift`
    - Added options: `--examples [mode]` (presence, typecheck, run), `--max-drift <percentage>`, `--format <format>`, `-o/--output <file>`, `--stdout`, `--no-cache`
    - Now supports multi-format output: text, json, markdown, html, github
    - Writes reports to `.doccov/` directory by default
  - Added spec-level caching (use `--no-cache` to bypass)
  - Simplified config schema to match new quality rules engine

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.8.0

## 0.9.0

### Minor Changes

- feat: sdk enhancments

  - Parse @see JSDoc tags and extract see-also relations
  - Extract structured example metadata (title, description, language) from @example blocks
  - Emit related field on classes (extends/implements), functions (returns), and interfaces (extends)
  - Update TypeReference to use SpecSchema type from spec package
  - Fix deterministic-fixes and jsdoc-writer to handle SpecExample objects

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.7.0

## 0.8.0

### Minor Changes

- add extraction features:

  - **@throws parsing**: Parse and structure @throws/@throw/@exception JSDoc tags
  - **Decorator extraction**: Extract decorators from classes, members, and parameters
  - **Module augmentation detection**: Detect and mark `declare module "..."` augmentations
  - **Conditional/mapped type analysis**: Extract structural information from conditional and mapped types

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.6.0

## 0.7.0

### Minor Changes

- fixed serialization of overloaded methods in classes and interfaces and enhanced jsdoc tag parsing to extract structured fields

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.5.0

## 0.6.0

### Minor Changes

- extract tsdoc parser, builtin detection, and ast extractor utilities

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.4.1

## 0.5.9

### Patch Changes

- feat: support typebox types

## 0.5.8

### Patch Changes

- feat: add lint and typechecking commands

## 0.5.7

### Patch Changes

- return all undocumented exports (not just new) in docs impact analysis
- Updated dependencies
  - @openpkg-ts/spec@0.4.0

## 0.5.6

### Patch Changes

- add member-level docs impact detection for classes - detects method additions, removals, and signature changes with smart replacement suggestions

## 0.3.7

### Patch Changes

- fix: cleanup internal/private type warnings

## 0.3.6

### Patch Changes

- fix duplicate null in schema

## 0.3.5

### Patch Changes

- fix interface member serialization with jsdocs

## 0.3.4

### Patch Changes

- fix computed type property resolution for TypeBox, Zod, and similar patterns where valueDeclaration is undefined

## 0.3.3

### Patch Changes

- feat(cli): add markdown docs impact detection to diff command
  refactor(cli): consolidate fix functionality into check command
  refactor(sdk): reuse detection extraction
  fix(api): bug in api scan
  fix(api): monorepo detection in scan
  fix(api): improve scan-stream reliability and ref support

## 0.3.0

### Minor Changes

- ## OpenPkg Spec Builder Improvements

  ### New Features

  - **Class inheritance**: Capture `extends` and `implements` clauses
  - **Namespace exports**: Support `export namespace X { ... }`
  - **Function overloads**: Capture all overload signatures
  - **Mapped/conditional types**: Preserve `tsType` for complex types
  - **External types**: Graceful handling with `kind: "external"` stubs
  - **Interface methods**: Serialize method signatures on interfaces
  - **Index signatures**: Capture `[key: string]: T` patterns
  - **Default values**: Preserve parameter defaults
  - **Rest parameters**: Mark with `rest: true`
  - **Getter/setter pairs**: Merge into single member
  - **Call/construct signatures**: Capture callable interfaces
  - **Type predicates**: Preserve `x is string` and `asserts x` returns
  - **Union discriminants**: Add `discriminator: { propertyName }` for tagged unions
  - **Re-export aliasing**: Correctly track `export { X as Y }`

  ### CLI Changes

  - Renamed `--no-external-types` to `--skip-resolve` across all commands
  - Added `--skip-resolve` to `report` and `scan` commands
  - New warnings for unresolved external types
  - Info message when `node_modules` not found

  ### Bug Fixes

  - Fixed circular type reference detection
  - Fixed destructured parameter TSDoc matching
  - Fixed drift detection for destructured params

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.3.0

## 0.2.2

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages
- Updated dependencies [c74cf99]
  - @openpkg-ts/spec@0.2.2

## 0.2.1

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages
- Updated dependencies [c74cf99]
  - @openpkg-ts/spec@0.2.1
