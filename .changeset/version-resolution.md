---
"@driftdev/cli": patch
---

Fix version resolution in the published bundle: `meta.version` reported `0.0.0` from dist (and fed the spec-cache key, neutering version-based invalidation). Name-checked lookup now works from both src and dist layouts.
