---
"@driftdev/sdk": minor
"@driftdev/cli": patch
---

New prose drift type: `prose-deprecated-reference` (17 drift types total). Docs code blocks that import or call an API the spec marks deprecated are flagged — with the spec's deprecation note surfaced as the suggestion — unless the surrounding prose (±5 lines) already acknowledges the deprecation. Deterministic version of a finding class previously only agents caught (e.g. clarinet's `runSnippet` promoted while its types say `@deprecated use execute`). Registry now indexes deprecated exports/members; `MarkdownDocFile` carries raw content for prose-context checks.
