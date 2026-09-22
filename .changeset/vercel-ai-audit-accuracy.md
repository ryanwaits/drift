---
'@driftdev/sdk': minor
'@driftdev/cli': patch
---

Page accuracy from the vercel/ai docs audit (374 pages):

- A heading joins a type for `spec-not-in-claims` only with evidence (code span / call form, page title, a fence that imports, constructs, calls or declares the export, or the docs map), and gaps dump only when the section documents the surface (declaration, parameter / option table, title or map). An option key in `new X({ tools })` mentions the member.
- A bare backticked member (`` `schema` ``) resolves only within a type in scope: a heading ancestor, the frontmatter title or the docs-map type. Leading-dot members keep their owner walk.
- New: `prose-unknown-key` in prose for "the `k` option" of an export whose options object is closed.
- `prose-unresolved-member`: a chained receiver (`result.stream.pipeThrough()`) is judged on the property's spec type, or skipped.
- JSX props from one object parameter the spec cannot close claim nothing; a self-`$ref` type export resolves to its full entry.
- Diff fences (`diff`, or `+` / `-` marker lines) are read as their added code.
- No `prose-broken-reference` under a heading or sentence that negates the API (`Removed`, `has been removed`).
- Before/after migration detection: `Before` / `Previous` / `Old` / `Migrating from` headings, version labels (`v4`, `title="AI SDK 5"`) lower than another on the page; a before fence runs no reference or call-site rule.
