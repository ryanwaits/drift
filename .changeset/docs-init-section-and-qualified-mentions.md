---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

`drift docs init` writes `sectionRe` into the stub when the matched table sits under a heading the default `option|config` regex misses, so the stub reproduces under scan. Key coverage counts qualified `Type.key` references (namespaces, classes) as mentions, and `drift docs propose` sends that evidence to Jev. Bump `@openpkg-ts/sdk` to ^0.53.1 (no more path-named types from `export * as Ns`).
