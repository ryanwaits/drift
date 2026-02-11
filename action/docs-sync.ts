/**
 * Standalone docs-sync script for GitHub Actions.
 * Runs after a PR merge with breaking changes — creates PRs on remote docs repos.
 *
 * Env: GITHUB_TOKEN, ANTHROPIC_API_KEY, GITHUB_EVENT_PATH
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { $ } from 'bun';
import { query } from '@anthropic-ai/claude-agent-sdk';

// --- Types ---

interface BreakingChange {
  name: string;
  kind: string;
  severity: string;
  reason: string;
}

interface RemoteDocsTarget {
  repo: string;
  branch?: string;
}

interface MergeEvent {
  pull_request: {
    merged: boolean;
    merge_commit_sha: string;
    number: number;
    base: { ref: string };
  };
  repository: { full_name: string };
}

// --- Config ---

function readDocsRemote(cwd: string): RemoteDocsTarget[] {
  const configPath = resolve(cwd, 'drift.config.json');
  if (existsSync(configPath)) {
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
      return raw.docs?.remote ?? [];
    } catch {
      return [];
    }
  }

  const pkgPath = resolve(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      return pkg.drift?.docs?.remote ?? [];
    } catch {
      return [];
    }
  }

  return [];
}

// --- Breaking changes detection ---

async function getBreakingChanges(cwd: string, baseSha: string): Promise<BreakingChange[]> {
  try {
    const result = await $`drift breaking --base ${baseSha} --json`.cwd(cwd).quiet().nothrow().text();
    const parsed = JSON.parse(result);
    return (parsed.data?.breaking ?? []) as BreakingChange[];
  } catch {
    return [];
  }
}

// --- Prompts ---

function buildDocsSyncSystemPrompt(): string {
  return `You fix documentation to match API breaking changes.

You have access to Bash, Read, Write, Edit, Glob, and Grep tools.

## Workflow
1. Use Grep to find all mentions of the broken exports in the docs repo
2. Read the surrounding context of each match
3. Edit docs to match the new API signatures and behavior
4. Do NOT create new files — only edit existing ones
5. If an export was removed, update docs to reflect removal
6. If a signature changed, update all code examples and descriptions

## Rules
- Only modify files that reference the changed exports
- Keep the existing doc style and tone
- If you can't find any references to a broken export, skip it
- Be precise — change only what's affected by the breaking changes
- After editing, run these git commands:
  1. git checkout -b {branchName}
  2. git add -A
  3. git commit -m "{commitMessage}"
  4. git push origin {branchName}
  5. gh pr create --title "{prTitle}" --body "{prBody}"`;
}

function buildDocsSyncUserPrompt(opts: {
  breakingChanges: BreakingChange[];
  sourceRepo: string;
  sourcePR: number;
  branchName: string;
}): string {
  const changes = opts.breakingChanges
    .map((c) => {
      return `- \`${c.name}\` (${c.kind}): ${c.reason}`;
    })
    .join('\n');

  return `The following breaking changes were merged in ${opts.sourceRepo}#${opts.sourcePR}:

${changes}

Search this docs repo for all references to these exports and update them to match the new API.

Branch name: ${opts.branchName}
Commit message: "docs: update for ${opts.sourceRepo}#${opts.sourcePR} breaking changes"
PR title: "docs: sync with ${opts.sourceRepo}#${opts.sourcePR}"
PR body: "Automated docs update for breaking changes in ${opts.sourceRepo}#${opts.sourcePR}.

### Changes
${changes}"`;
}

// --- Sync a single remote docs repo ---

async function syncDocsRepo(
  target: RemoteDocsTarget,
  breakingChanges: BreakingChange[],
  sourceRepo: string,
  prNumber: number,
  token: string,
): Promise<void> {
  const [owner, repo] = target.repo.split('/');
  const workDir = `/tmp/drift-docs-sync-${owner}-${repo}-${prNumber}`;
  const branchName = `drift/sync-${sourceRepo.replace('/', '-')}-${prNumber}`;

  try {
    const url = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    const args = target.branch ? ['--branch', target.branch] : [];
    await $`git clone ${url} ${workDir} --depth=50 ${args}`.quiet();
    await $`git -C ${workDir} config user.name "drift[bot]"`.quiet();
    await $`git -C ${workDir} config user.email "drift[bot]@users.noreply.github.com"`.quiet();

    for await (const message of query({
      prompt: buildDocsSyncUserPrompt({
        breakingChanges,
        sourceRepo,
        sourcePR: prNumber,
        branchName,
      }),
      options: {
        systemPrompt: buildDocsSyncSystemPrompt(),
        cwd: workDir,
        allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        model: 'claude-sonnet-4-5-20250929',
        maxTurns: 20,
        env: { ...process.env, GH_TOKEN: token } as Record<string, string>,
      },
    })) {
      if ('result' in message) {
        console.log(`[docs-sync] Done for ${target.repo}: ${(message.result as string).slice(0, 200)}`);
      }
    }
  } finally {
    await $`rm -rf ${workDir}`.quiet().nothrow();
  }
}

// --- Main ---

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!token || !anthropicKey || !eventPath) {
    console.error('[docs-sync] Missing required env: GITHUB_TOKEN, ANTHROPIC_API_KEY, GITHUB_EVENT_PATH');
    process.exit(1);
  }

  const event: MergeEvent = JSON.parse(readFileSync(eventPath, 'utf-8'));
  const pr = event.pull_request;
  if (!pr?.merged || !pr.merge_commit_sha) {
    console.log('[docs-sync] Not a merged PR, skipping');
    process.exit(0);
  }

  const sourceRepo = event.repository.full_name;
  const cwd = process.cwd();

  // Detect breaking changes: compare merge commit against its parent
  const breakingChanges = await getBreakingChanges(cwd, `${pr.merge_commit_sha}^1`);
  if (breakingChanges.length === 0) {
    console.log('[docs-sync] No breaking changes, skipping');
    process.exit(0);
  }
  console.log(`[docs-sync] ${breakingChanges.length} breaking changes found`);

  const targets = readDocsRemote(cwd);
  if (targets.length === 0) {
    console.log('[docs-sync] No docs.remote targets configured, skipping');
    process.exit(0);
  }

  for (const target of targets) {
    console.log(`[docs-sync] Syncing ${target.repo}`);
    try {
      await syncDocsRepo(target, breakingChanges, sourceRepo, pr.number, token);
    } catch (err) {
      console.error(`[docs-sync] Failed for ${target.repo}:`, err);
    }
  }
}

main();
