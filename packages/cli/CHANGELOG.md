# @doccov/cli

## 0.29.1

### Patch Changes

- update docs + action to use .doccov/{pkg}/ output structure, add logo to badges

## 0.29.0

### Minor Changes

- feat(badge): use doccov.json report instead of openpkg.json

  Badge endpoints now read health score from `.doccov/doccov.json` instead of computing from `openpkg.json`. Added remote docs fetching to CLI (URL, GitHub patterns) with caching support. Moved spec cache to `.doccov/cache/` subdirectory.

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.29.0

## 0.28.2

### Patch Changes

- fix(cli): fail check on runtime errors; fix(sdk): compute drift ratio from total exports
- Updated dependencies
  - @doccov/sdk@0.28.2

## 0.28.1

### Patch Changes

- 24f04ff: style: sort imports alphabetically, remove unused import
- Updated dependencies [24f04ff]
  - @doccov/sdk@0.28.1

## 0.28.0

### Minor Changes

- refactor: major cleanup - move platform packages, simplify CLI

  ## Package Restructure

  - Moved `api-shared`, `auth`, `db`, `sandbox`, `ui` from `packages/` to `apps/platform/`
  - These are now internal platform code, not publishable packages

  ## CLI Removals

  - Removed `info` command
  - Removed deprecated flags: `--min-coverage`, `--max-drift`, `--min-api-surface`, `--update-snapshot`
  - Removed output formats: `html`, `github`, `pr-comment`, `changelog`
  - Removed report renderers: changelog-renderer, github, html, pr-comment

  ## SDK Changes

  - Removed `RetentionTier` type and `pruneByTier` function (simplified to single 90-day retention)
  - Removed deprecated `minCoverage`, `maxDrift`, `minApiSurface` from `CheckConfig` type
  - Moved config schema from CLI to SDK (`docCovConfigSchema`, `normalizeConfig`)
  - Exported `DocCovConfigInput` type for config validation

  ## Type System

  - Renamed `NormalizedDocCovConfig` to `DocCovConfig`
  - Config validation schema still accepts deprecated fields for backwards compat

  ## Breaking Changes

  - Consumers using removed CLI commands/flags need to migrate
  - Consumers using tier-based retention need to use simple `pruneHistory()`

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.28.0

## 0.27.1

### Patch Changes

- fix: use resolved targetDir for cwd in check command instead of raw options.cwd

## 0.27.0

### Patch Changes

- Add unified documentation health score combining completeness + accuracy metrics
- Updated dependencies
  - @doccov/spec@0.27.0
  - @doccov/sdk@0.27.0

## 0.26.0

### Minor Changes

- Add API surface completeness analysis for forgotten exports detection

### Patch Changes

- Updated dependencies
  - @doccov/spec@0.26.0
  - @doccov/sdk@0.26.0

## 0.25.11

### Patch Changes

- chore: bump @doccov/sdk dependency
- Updated dependencies
  - @doccov/sdk@0.25.11

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
  - @doccov/sdk@0.25.9

## 0.25.8

### Patch Changes

- fix(extract): correct package.json exports path (dist/index.js -> dist/src/index.js)
- Updated dependencies
  - @doccov/sdk@0.25.8

## 0.25.7

### Patch Changes

- Bump sdk dependency
- Updated dependencies
  - @doccov/sdk@0.25.7

## 0.25.6

### Patch Changes

- Bump SDK dependency with consolidated type extraction.

## 0.25.3

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @openpkg-ts/spec@0.12.0
  - @doccov/sdk@0.25.3

## 0.25.0

### Patch Changes

- Remove unused enrichment/diff code from SDK, delete unused UI components (drift-command-center, fix-workflow, pr-coverage)
- Updated dependencies
  - @doccov/sdk@0.25.0

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
  - @doccov/sdk@0.24.1
  - @openpkg-ts/spec@0.11.1
  - @doccov/spec@0.24.1

## 0.24.0

### Patch Changes

- Consolidate drift types in SDK, simplify spec package, add source extraction to spec command
- Updated dependencies
  - @doccov/sdk@0.24.0
  - @doccov/spec@0.24.0

## 0.23.0

### Patch Changes

- refactor: modularize api into shared packages with centralized middleware
- Updated dependencies
  - @doccov/sdk@0.23.0

## 0.22.0

### Minor Changes

- Remove deprecated `tsType` field in favor of `schema`, add CLI warning when `--runtime` requested without built code

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.22.0
  - @openpkg-ts/spec@0.11.0

## 0.21.0

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.21.0

## 0.20.0

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.20.0

## 0.19.0

### Minor Changes

- feat: hybrid schema extraction for Zod, Valibot, TypeBox, ArkType

  - Static extraction via TypeScript Compiler API (default, no runtime)
  - Runtime extraction via Standard Schema spec (opt-in, richer output)
  - New `--runtime` CLI flag enables hybrid mode
  - Falls back gracefully from runtime to static extraction

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.19.0

## 0.18.0

### Minor Changes

- Enhanced quality rules, filtering, github context, analysis reports, new API routes (ai, billing, demo, github-app, invites, orgs), trends command, diff capabilities

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.18.0
  - @openpkg-ts/spec@0.10.0

## 0.17.0

### Minor Changes

- feat: add YAML config support (doccov.yml)

  - Added `--format yaml` option to `doccov init` command
  - Config loader now supports `doccov.yml` and `doccov.yaml` files
  - YAML configs are simpler - no imports or TypeScript needed

## 0.16.0

### Minor Changes

- feat(cli): add --format pr-comment for actionable GitHub PR comments

  - New pr-comment format with coverage summary, undocumented exports grouped by file, drift issues, contextual fix guidance
  - Added --repo-url and --sha options for clickable file links
  - Added strict mode presets: ci, release, quality
  - Moved PR comment rendering from action.yml inline JS to CLI

## 0.15.1

### Patch Changes

- Consolidate duplicate FIXABLE_DRIFT_TYPES into single isFixableDrift() source
- Updated dependencies
  - @doccov/sdk@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.15.0

## 0.14.0

### Minor Changes

- Add step-based progress feedback for CLI commands

  - Added `StepProgress` utility for multi-step progress tracking with timing
  - Added `ProgressBar` utility for incremental progress with percentage/ETA display
  - Updated `spec` command to show 5-step progress (resolve, config, generate, validate, write)
  - Updated `check` command to show 5-6 step progress (includes optional example validation step)
  - Removed `ora` dependency in favor of simpler carriage-return based progress that doesn't freeze during I/O blocking operations

## 0.13.0

### Patch Changes

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

- Updated dependencies [e063639]
  - @doccov/sdk@0.13.0
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

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.12.0

## 0.11.0

### Minor Changes

- Version sync release

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.11.0

## 0.10.2

### Patch Changes

- Update @doccov/sdk dependency to include monorepo entry point path fix

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
  - @doccov/sdk@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @doccov/sdk@0.9.0
  - @openpkg-ts/spec@0.7.0

## 0.8.0

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @doccov/sdk@0.8.0
  - @openpkg-ts/spec@0.6.0

## 0.7.0

### Minor Changes

- consolidate cli by removing lint, report, and typecheck commands (now in SDK). simplify check, generate, and scan commands to use unified SDK modules.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @openpkg-ts/spec@0.5.0
  - @doccov/sdk@0.7.0

## 0.6.0

### Patch Changes

- update command implementations and config
- Updated dependencies
- Updated dependencies
  - @doccov/sdk@0.6.0
  - @openpkg-ts/spec@0.4.1

## 0.5.8

### Patch Changes

- feat: add lint and typechecking commands
- Updated dependencies
  - @doccov/sdk@0.5.8

## 0.5.7

### Patch Changes

- show holistic documentation coverage percentage in diff output
- Updated dependencies
- Updated dependencies
  - @openpkg-ts/spec@0.4.0
  - @doccov/sdk@0.5.7

## 0.5.6

### Patch Changes

- enhance diff command output with member-level changes section and method-level targeting in docs impact
- Updated dependencies
  - @doccov/sdk@0.5.6

## 0.5.4

### Patch Changes

- bug(cli): do not check for doccov config in `diff` when no `--docs` flag is supplied

## 0.5.3

### Patch Changes

- chore(cli): cleanup progress feedback

## 0.5.2

### Patch Changes

- Fix spinner animation freezing during long-running operations by configuring ora with proper stdin handling and cursor management. Also update SDK dependency to ^0.3.7 to include latest fixes.

## 0.5.1

### Patch Changes

- chore: cleanup ux feedback and add err check for scanning private repos

## 0.5.0

### Minor Changes

- feat(cli): add markdown docs impact detection to diff command
  refactor(cli): consolidate fix functionality into check command
  refactor(sdk): reuse detection extraction
  fix(api): bug in api scan
  fix(api): monorepo detection in scan
  fix(api): improve scan-stream reliability and ref support

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.3.3

## 0.4.7

### Patch Changes

- Fix findPackageInMonorepo to check root package.json first, enabling analysis of repos where the main package is at the root (like zod)

## 0.4.6

### Patch Changes

- Fix monorepo package detection for pnpm workspaces by parsing pnpm-workspace.yaml

## 0.4.5

### Patch Changes

- Use improved entry point detection in generate command. When using `--cwd`, the CLI now correctly resolves `.d.ts` paths to source files and supports more project structures.

## 0.4.4

### Patch Changes

- Fix entry point detection to prefer .ts source files over .d.ts declarations. Scanning repos with `types` field pointing to `.d.ts` now correctly resolves to source files like `src/index.ts`.

## 0.4.0

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
  - @doccov/sdk@0.3.0
  - @openpkg-ts/spec@0.3.0

## 0.3.0

### Minor Changes

- Add --ignore-drift flag to check command to allow drift detection without failing the check

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages
- Updated dependencies [c74cf99]
  - @openpkg-ts/spec@0.2.2
  - @doccov/sdk@0.2.2

## 0.2.1

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages
- Updated dependencies [c74cf99]
  - @openpkg-ts/spec@0.2.1
  - @doccov/sdk@0.2.1
