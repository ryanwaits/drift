---
'@driftdev/sdk': minor
'@driftdev/cli': minor
---

Coverage accuracy + external docs corpus (posthog-js dogfood fixes):

- Coverage no longer counts external re-exports as undocumented. Exports whose
  declaration lives outside the analyzed program (`source.file === '<external>'`
  or a package-only source) are excluded from the denominator in
  `buildDriftSpec`, `scan`, `coverage`, and `health`, and surfaced separately:
  `summary.externalExports` / `health.completeness.external` in the SDK,
  `coverage.external` in CLI JSON, and a "+N external (not resolvable here)"
  note in human output. New SDK exports: `isExternalExport`,
  `EXTERNAL_SOURCE_FILE`; `ApiSource` gains `package`/`version`.
- New `--docs <patterns...>` flag on `scan` and `lint`: point prose drift at an
  arbitrary markdown corpus (glob patterns or directories, e.g. a hosted docs
  site pulled down locally) instead of the repo-local defaults. Runs for any
  language when given explicitly; warns when patterns match no files.
