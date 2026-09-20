---
"@driftdev/sdk": patch
"@driftdev/cli": patch
---

PageDocument precision: `import * as ns` is a namespace alias (never a missing export; `ns.member` is checked as the export); receivers and bare callees bind only through a visible import or construction, not a coincidental name; foreign-import and Before/Previous fences are silent.
