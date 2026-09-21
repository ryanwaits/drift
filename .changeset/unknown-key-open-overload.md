---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

`prose-unknown-key`: an overload that takes an object at that position whose keys cannot be seen (unresolved, generic, open) silences the rule instead of being skipped, so a key only that overload declares is not reported (zod `toJSONSchema(registry, { uri })`). Overloads that take a primitive or a function there still do not count.
