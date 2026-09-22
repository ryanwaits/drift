---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

On OpenPkg 0.55: a function that destructures one options object is one parameter, so `embed({ model, value })` is checked key by key instead of being read as one positional argument.
