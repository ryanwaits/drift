/**
 * GitHub CI environment helpers.
 * Reads standard GitHub Actions env vars.
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';

export interface GitHubContext {
  isPR: boolean;
  baseRef: string | null;
  token: string | null;
  repository: string | null;
  eventPath: string | null;
  stepSummary: string | null;
  sha: string | null;
}

export function getGitHubContext(): GitHubContext {
  return {
    isPR: process.env.GITHUB_EVENT_NAME === 'pull_request',
    baseRef: process.env.GITHUB_BASE_REF ?? null,
    token: process.env.GITHUB_TOKEN ?? null,
    repository: process.env.GITHUB_REPOSITORY ?? null,
    eventPath: process.env.GITHUB_EVENT_PATH ?? null,
    stepSummary: process.env.GITHUB_STEP_SUMMARY ?? null,
    sha: process.env.GITHUB_SHA ?? null,
  };
}

export function getPRNumber(eventPath: string | null): number | null {
  if (!eventPath || !existsSync(eventPath)) return null;
  try {
    const event = JSON.parse(readFileSync(eventPath, 'utf-8'));
    return event.pull_request?.number ?? null;
  } catch {
    return null;
  }
}

export function writeStepSummary(markdown: string): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, `${markdown}\n`);
  }
}

export async function postOrUpdatePRComment(
  repo: string,
  prNumber: number,
  token: string,
  body: string,
): Promise<void> {
  const marker = '<!-- drift-ci -->';
  const fullBody = `${marker}\n${body}`;
  const apiBase = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  // Find existing comment
  try {
    const res = await fetch(apiBase, { headers });
    if (res.ok) {
      const comments = (await res.json()) as Array<{ id: number; body?: string }>;
      const existing = comments.find((c) => c.body?.startsWith(marker));
      if (existing) {
        await fetch(`https://api.github.com/repos/${repo}/issues/comments/${existing.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ body: fullBody }),
        });
        return;
      }
    }
  } catch {}

  // Create new comment
  await fetch(apiBase, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: fullBody }),
  });
}
