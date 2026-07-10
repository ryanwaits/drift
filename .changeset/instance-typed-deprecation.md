---
"@driftdev/sdk": minor
"@driftdev/cli": patch
---

Instance typing for prose-deprecated-reference. The registry now maps callable exports to their named return types (Promise unwrapped), so `const simnet = await initSimnet()` types `simnet` as `Simnet` — deprecated members are judged against the actual type instead of being suppressed when an identically-named non-deprecated member exists elsewhere (the proxy-over-raw-class pattern: clarinet's `runSnippet`). Deprecation notes also flow from `deprecationReason` fields, not just `@deprecated` tags.
