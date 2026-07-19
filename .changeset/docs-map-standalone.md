---
'@driftdev/cli': patch
'@driftdev/sdk': patch
---

`drift scan --docs-map` now runs standalone in docs-only repos: when every
page in the map carries its own `spec` (or `entry`), no package entry point is
required — previously scan exited 2 with "Could not detect entry point" in
repos with no TypeScript package (the exact shape of a docs site gating SDK
pages against committed specs). In standalone mode the output contains only
`docsCoverage`; package `coverage`/`lint`/`health` are omitted.

Also: `--annotations` now emits workspace-relative `file=` paths (GitHub only
anchors annotations to the Files Changed view for relative paths), and the SDK
key-coverage analysis accepts types-only specs (no `exports` array) without
crashing.
