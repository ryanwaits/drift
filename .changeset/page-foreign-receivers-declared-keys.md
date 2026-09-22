---
"@driftdev/sdk": minor
"@driftdev/cli": patch
---

Page documents: a receiver bound by an import from another package (`import { z } from 'zod'`; `z.string()`) is foreign and never a `prose-broken-reference`, whatever this package exports; a `ns.member` broken reference stands only on an explicit `import * as ns` of the package, never on an inferred alias. A fence that prints `interface X { ... }` / `type X = { ... }` / `class X { ... }` mentions every key its body declares (no `spec-not-in-claims` for them). New rule `prose-declared-key` (`RuleHit['type']`): a key such a printed body declares that the spec's X does not have (`'args' is not a member of 'ToolCallPart'`), silent on open or memberless spec shapes. An object literal whose body carries an elision marker (`// ...`, `/* ... */`, `…`, a spread) is a partial sample: no `prose-missing-required` on it, while a key it does write is still `prose-unknown-key`.
