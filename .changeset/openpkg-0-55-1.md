---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

On OpenPkg 0.55.1: a destructured union parameter keeps which keys a caller must pick between, so `generateText({ model })` is reported as needing one of `prompt`, `messages`.
