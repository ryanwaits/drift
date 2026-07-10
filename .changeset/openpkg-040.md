---
"@driftdev/sdk": minor
"@driftdev/cli": minor
---

Bump @openpkg-ts/sdk to ^0.40.0: extraction now flattens mapped/conditional type aliases into members (with `@deprecated` recovered from conditional arm aliases), gives function-type aliases real signatures, and defaults to strict so `T | undefined` unions survive. Combined with 1.8's instance typing, `prose-deprecated-reference` now works on wasm/proxy surfaces — e.g. `drift lint <clarinet-sdk> --docs guides/` deterministically flags `simnet.runSnippet` with "use `simnet.execute(command)` instead".
