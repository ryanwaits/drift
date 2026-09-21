---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

PageDocument precision and locators. A default import binds to the spec's `default` export (call-site rules on every overload, `candidate` claims with `specRef.export: 'default'`; silent when the spec has none, never matched by name). A rest parameter is never required and lifts the arity bound (`rest: true`, `...args`, or an untyped trailing `args` / `rest`). A zero-argument call that is a whole expression statement (`z.map();`) is a mention, not `prose-missing-required`. `import { a: b }` is reported as invalid import syntax on that specifier instead of a missing export. A bare callee the fence declares itself is not the export of the same name. Fixes: a `#` line inside a fenced code block is never a heading (one shared fence test for every line scanner); every fence claim is located inside its own fence at the exact line and column, never on the first occurrence of the text on the page.
