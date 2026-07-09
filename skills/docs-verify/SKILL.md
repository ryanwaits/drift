---
name: docs-verify
description: Verify an entire docs site/directory against the real API surface using drift as the truth oracle. Use when asked to audit docs accuracy, check hand-written guides against an OpenAPI spec or TypeScript package, find stale/phantom documentation, or produce a docs-drift report. Triggers on "verify the docs", "audit docs against the API", "are these guides accurate", "docs drift report".
---

# docs-verify: claims vs truth

Audit documentation of ANY shape (markdown dirs, MDX, rendered HTML pages, URL lists) against a deterministic API truth source. You do the reading and claim extraction; `drift` provides ground truth. Never judge a claim from memory.

## Inputs (ask if missing)

1. **Docs source** — directory/glob (`docs/**/*.md`), URL list, or a site root to crawl.
2. **Truth source** — one of:
   - TypeScript package: project dir (entry auto-detected)
   - OpenAPI 3.x: `--spec <path-or-https-url>`
   - Clarity: `<contract.clar> --abi <abi.json>`

## Procedure

### 1. Load the truth surface once
```bash
drift list --full --json [truth flags]     # every export/operation: name, kind, deprecated
```
Keep this list in hand — it's the existence oracle.

### 2. Enumerate docs pages
Local: glob the files. Remote: fetch each URL (rendered text is fine). Skip changelogs and marketing-only pages unless asked.

### 3. Per page: extract claims
A claim is any checkable statement about the API:
- a named export/endpoint/function ("call `candidate.info`", "`createClient(url, options)`")
- a parameter list, its optionality/requiredness, or types
- a response/return shape
- deprecation or availability statements
- code examples invoking the API

### 4. Verify each claim — one `drift get` at a time
```bash
drift get <name> --json [truth flags]
```
- Name not found → check `drift list` output for renames (fuzzy suggestions are in the error) before calling it phantom.
- Compare the claim against `data.export`: parameters (names, `required`, types via `schema`), `returns`, `deprecated`, `flags.method`/`flags.path` for REST.

### 5. Classify findings
| Class | Meaning |
|---|---|
| `phantom` | documented, does not exist in the API |
| `missing-param` | docs omit a required parameter |
| `wrong-param` | wrong name, type, or optionality |
| `wrong-response` | documented return/response shape mismatches |
| `stale-deprecation` | deprecated in API but docs don't say (or vice versa) |
| `example-drift` | code example would not work against the real API |
| `undocumented` | exists in API, no docs page covers it (from the step-1 list) |

Severity: `breaking` (user following docs fails), `warning` (misleading), `info` (cosmetic).

### 6. Report → `DRIFT-REPORT.md`

```markdown
# Docs Drift Report: <docs source> vs <truth source>

**Verified N claims across M pages against X exports/operations.**
Findings: A breaking / B warning / C info. Coverage: Y of X surface items documented.

| # | Class | Sev | Docs location | Claim | Truth |
|---|-------|-----|---------------|-------|-------|
| 1 | wrong-param | breaking | guides/candidates.md:42 | `id` optional | `id` required (drift_get candidateInfo) |

## Suggested fixes
Per finding: the exact edit, quoting the authoritative signature.

## Undocumented surface
- names from step 1 with no docs coverage
```

Offer `--json` variant of the same data on request.

## Rules

- **Every verdict cites a `drift get` result.** No claim is judged from memory or prior knowledge of the product.
- Verify the claim the docs actually make, not what they probably meant.
- Prose tone/style is out of scope — factual accuracy only.
- Big surfaces: verify every documented claim, then sample `undocumented` reporting to the top 20 by likely importance; say what was sampled.
- Read-only: produce the report; only edit docs if the user asks for fixes afterward.
