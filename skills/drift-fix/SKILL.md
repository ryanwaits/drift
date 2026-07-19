---
name: drift-fix
description: Fix documentation drift reported by drift scan/lint — stale signatures, wrong parameter names/types, references to removed or renamed exports, prose drift in markdown. Use after `drift scan` or `drift lint` reports issues, or when asked to "fix drift", "fix the docs", "sync docs to the API". Edits docs to match the API, never the reverse.
---

# Drift Fix: Make Docs Match Reality

Fix every issue `drift lint` reports, verifying each correction against the truth oracle. Docs move toward the API — never edit code to match docs unless the user says the docs are the intent.

## Loop

1. `drift lint --json` (add `--spec`/`--abi`/`--docs` truth flags as needed) → issues with `filePath` + `line`.
2. For each issue:
   - `drift get <export> --json` → the authoritative signature/params/deprecation.
   - Edit the doc (or JSDoc) at `filePath:line` to match. Only touch code references, signatures, parameter tables, and factual claims — preserve the prose voice around them.
   - Unknown/removed export referenced in docs? `drift list <name> --json` for the closest current name; if it was renamed, update the reference; if truly removed, delete or rewrite the claim.
3. Re-run `drift lint --json` until `count` is 0.
4. Report: issues fixed (with file:line), issues intentionally left (with reason).

## Rules

- One `drift get` per claim you rewrite — never from memory.
- Never invent parameter descriptions; copy meaning from the spec's descriptions or leave the existing prose.
- Deprecated export documented as current? Point docs at the replacement (`drift get` shows deprecation reason) and mark the old form deprecated — don't silently delete.
- Exit codes: 0 clean, 1 findings, 2 tool error. A persistent 2 means fix the invocation, not the docs.
