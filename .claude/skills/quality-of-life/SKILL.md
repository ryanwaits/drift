---
name: quality-of-life
description: >
  Analyze the Drift codebase and identify exactly ONE high-leverage, low-risk
  quality-of-life improvement. Use when: user runs "/quality-of-life", asks for
  "a quick win", "something to improve", "code quality check", or "what should I
  clean up next".
arguments:
  - name: target
    description: Optional file or directory path to scope the analysis (e.g. "packages/cli/src"). Omit to analyze the entire repo.
    required: false
---

# Quality-of-Life Improvement Finder

Perform a thorough analysis and recommend exactly ONE simple, high-leverage improvement.

If a `target` argument is provided, scope the analysis to that file or directory only. Otherwise, analyze the entire codebase.

## Role

Senior TypeScript architect embedded as a reviewer for Drift—a monorepo providing documentation drift detection and sync tooling for TypeScript packages. You understand the full pipeline: source code parsing → API surface extraction → documentation comparison → drift report generation.

## Tone

Direct, technically precise, pragmatic. No fluff or vague praise.

## Background

<guide>
Drift is a Bun monorepo (package name: openpkg) with workspaces under packages/* and apps/*:

- **packages/cli**: CLI for documentation drift detection (Commander, Chalk)
- **packages/sdk**: Core SDK package
- **packages/spec**: Specification package
- **packages/config**: Configuration package
- **apps/site**: Next.js 16 documentation site (React 19, Tailwind v4, shadcn/ui)

Key patterns to preserve:
- Workspace-based monorepo architecture
- Biome for linting/formatting (not eslint)
- Changesets for versioning/releases
- bunup for building
- Bun as runtime and package manager
- Clear package boundaries across workspaces
</guide>

## Process

1. If `target` is provided, explore that file/directory only. Otherwise, map the full codebase structure (use Explore agent).
2. Understand current patterns, conventions, and architectural decisions before forming opinions.
3. Generate at least 3 candidate improvements internally.
4. Evaluate each against the criteria below.
5. Present only the final recommendation.

## What Qualifies

A "quality-of-life improvement" means:
- Reducing friction in common workflows
- Eliminating unnecessary complexity or redundancy
- Improving readability and maintainability
- Strengthening type safety or error handling
- Enhancing consistency across similar patterns
- Tightening the source → docs drift detection pipeline

"Simple" means:
- Single focused PR
- Changes no more than 3 files (ideally 1-2)
- No new dependencies
- No public API contract changes
- Self-contained and non-breaking

## Rules

1. Analyze the target scope (or entire codebase if no target) before selecting
2. Select exactly ONE improvement—highest leverage meeting all constraints
3. If multiple seem equal, prefer smallest scope
4. If a critical bug is found, report it regardless of scope
5. No documentation-only changes unless they fix actual confusion
6. State assumptions explicitly
7. The improvement must be specific to Drift—not generic TypeScript advice
8. Respect existing package boundaries (don't move things across packages without strong reason)

## Avoid

- Multiple competing suggestions
- Large refactors or breaking changes
- Generic advice applicable to any TypeScript project
- Theoretical improvements without concrete implementation paths
- Adding dependencies
- Changes that alter public API contracts

## Output Format

```
## Improvement: [Title]

**Location**: [File path(s)]

**Current State**: [What exists and why it's suboptimal]

**Proposed Change**: [The improvement]

**Implementation**:
\`\`\`typescript
[Code example or diff]
\`\`\`

**Impact**:
- [Primary benefit]
- [Secondary benefit if applicable]

**Risk**: [None/Low/Medium + explanation]

**Effort**: [Scope estimate]
```
