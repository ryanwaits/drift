/**
 * Lightweight docs notification for GitHub Actions.
 * Creates issues on remote docs repos when breaking changes are detected.
 * No AI required — includes a copy-pasteable prompt for agent-assisted fixes.
 *
 * Env: GITHUB_TOKEN, GITHUB_EVENT_PATH
 */

import { $ } from 'bun';
import {
  type BreakingChange,
  type RemoteDocsTarget,
  parseMergeEvent,
  readDocsRemote,
  getBreakingChanges,
  formatChangesList,
} from './shared';

// --- Issue body ---

function buildIssueBody(opts: {
  breakingChanges: BreakingChange[];
  sourceRepo: string;
  sourcePR: number;
}): string {
  const changes = formatChangesList(opts.breakingChanges);
  const searchTerms = opts.breakingChanges.map((c) => `\`${c.name}\``).join(', ');

  const agentPrompt = opts.breakingChanges
    .map((c) => `- \`${c.name}\` (${c.kind}) was ${c.reason}`)
    .join('\n');

  return `## Breaking Changes

The following breaking changes were merged in [${opts.sourceRepo}#${opts.sourcePR}](https://github.com/${opts.sourceRepo}/pull/${opts.sourcePR}):

${changes}

## Search Terms

Search your docs for: ${searchTerms}

## Fix with AI

Clone this repo and run:

\`\`\`bash
# Paste this prompt into Claude Code:
\`\`\`

<details>
<summary>Copy-pasteable prompt</summary>

\`\`\`
The following breaking changes were merged in ${opts.sourceRepo}#${opts.sourcePR}:

${agentPrompt}

Search this codebase for all documentation references to these exports.
For each match:
- If the export was removed, remove or update the section
- If it was renamed, update all references to the new name
- If the signature changed, update code examples and descriptions

Only modify files that reference these exports. Keep existing doc style.
\`\`\`

</details>

## Action Required

Review and update any documentation that references the above exports.

---
*Created by [drift](https://github.com/ryanwaits/drift) — documentation drift detection*`;
}

// --- Create issue on a single remote docs repo ---

async function createDocsIssue(
  target: RemoteDocsTarget,
  breakingChanges: BreakingChange[],
  sourceRepo: string,
  prNumber: number,
): Promise<void> {
  const title = `docs: breaking changes from ${sourceRepo}#${prNumber}`;
  const body = buildIssueBody({ breakingChanges, sourceRepo, sourcePR: prNumber });

  await $`gh issue create --repo ${target.repo} --title ${title} --body ${body}`.quiet();
}

// --- Main ---

async function main(): Promise<void> {
  const ctx = parseMergeEvent();
  if (!ctx) {
    console.log('[docs-issue] Not a merged PR or missing env, skipping');
    process.exit(0);
  }

  const { event } = ctx;
  const pr = event.pull_request;
  const sourceRepo = event.repository.full_name;
  const cwd = process.cwd();

  const breakingChanges = await getBreakingChanges(cwd, `${pr.merge_commit_sha}^1`);
  if (breakingChanges.length === 0) {
    console.log('[docs-issue] No breaking changes, skipping');
    process.exit(0);
  }
  console.log(`[docs-issue] ${breakingChanges.length} breaking changes found`);

  const targets = readDocsRemote(cwd);
  if (targets.length === 0) {
    console.log('[docs-issue] No docs.remote targets configured, skipping');
    process.exit(0);
  }

  for (const target of targets) {
    console.log(`[docs-issue] Creating issue on ${target.repo}`);
    try {
      await createDocsIssue(target, breakingChanges, sourceRepo, pr.number);
      console.log(`[docs-issue] Issue created on ${target.repo}`);
    } catch (err) {
      console.error(`[docs-issue] Failed for ${target.repo}:`, err);
    }
  }
}

main();
