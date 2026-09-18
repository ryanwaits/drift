---
"@driftdev/cli": patch
---

`drift docs propose --docs` (no docs file yet) now carries the stub's `sectionRe`, same as `drift docs init`. Both build entries through one `stubPage`, so pages whose tables sit under non-default headings no longer reach Jev with every key counted as a gap.
