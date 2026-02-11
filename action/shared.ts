/**
 * Shared types and utilities for drift GitHub Action scripts.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { $ } from 'bun';

// --- Types ---

export interface BreakingChange {
  name: string;
  kind: string;
  severity: string;
  reason: string;
}

export interface RemoteDocsTarget {
  repo: string;
  branch?: string;
}

export interface MergeEvent {
  pull_request: {
    merged: boolean;
    merge_commit_sha: string;
    number: number;
    base: { ref: string };
  };
  repository: { full_name: string };
}

// --- Config ---

export function readDocsRemote(cwd: string): RemoteDocsTarget[] {
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

export async function getBreakingChanges(cwd: string, baseSha: string): Promise<BreakingChange[]> {
  try {
    const result = await $`drift breaking --base ${baseSha} --json`.cwd(cwd).quiet().nothrow().text();
    const parsed = JSON.parse(result);
    // Handle both single-package and monorepo batch output
    if (parsed.data?.packages) {
      return parsed.data.packages.flatMap((p: { breaking: BreakingChange[] }) => p.breaking ?? []);
    }
    return (parsed.data?.breaking ?? []) as BreakingChange[];
  } catch {
    return [];
  }
}

// --- Event parsing ---

export function parseMergeEvent(): { event: MergeEvent; token: string } | null {
  const token = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!token || !eventPath) {
    return null;
  }

  const event: MergeEvent = JSON.parse(readFileSync(eventPath, 'utf-8'));
  const pr = event.pull_request;
  if (!pr?.merged || !pr.merge_commit_sha) {
    return null;
  }

  return { event, token };
}

// --- Formatting ---

export function formatChangesList(changes: BreakingChange[]): string {
  return changes
    .map((c) => `- \`${c.name}\` (${c.kind}): ${c.reason}`)
    .join('\n');
}
