---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

On OpenPkg 0.55.2: a type alias that only references another named type carries no members of its own, so its page is not asked to document the target's members.
