---
name: drift-enrich
description: Document undocumented API surface found by drift — generate signature-accurate JSDoc/doc stubs for exports that lack documentation. Use after `drift scan`/`drift coverage` reports undocumented exports, or when asked to "improve doc coverage", "document the API", "add missing docs". Produces stubs with TODO prose markers, never invented descriptions.
---

# Drift Enrich: Document the Undocumented

Raise coverage by adding signature-accurate documentation for exports `drift` reports as undocumented. Structure comes from the spec; prose meaning comes from the human.

## Loop

1. `drift list --undocumented --json` (add `--spec`/`--abi` truth flags as needed) → the backlog.
2. For each export:
   - `drift get <name> --json` → params (names, types, required), returns, deprecation.
   - Write the doc/JSDoc stub: every param listed with its real type and optionality, return shape stated, deprecation carried over.
   - Where the spec has a description, use it. Where it doesn't, insert `<!-- TODO: describe -->` (markdown) or `TODO:` (JSDoc) — never invent behavior.
3. `drift coverage --json` to confirm the score moved.
4. Report: exports documented, TODOs left for the human, before/after coverage.

## Rules

- Signatures from `drift get` only — never from reading source or memory.
- A stub with an honest TODO beats a confident hallucination; wrong prose is drift you just created.
- Match the file's existing doc conventions (JSDoc tags used, table formats) before adding new ones.
- Skip exports tagged `@internal` unless the user asks.
