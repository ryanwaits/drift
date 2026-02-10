---
"@doccov/cli": patch
---

Fix stale cache after JSDoc edits: include max source file mtime in cache key so editing any .ts file in the package busts the cache
