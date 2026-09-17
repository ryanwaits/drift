/**
 * Post/update a PR comment from `drift --json` output.
 * Annotations (::error) may precede or follow the JSON envelope — strip them.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const marker = '<!-- drift-ci -->';

function parseEnvelope(raw: string): Record<string, unknown> | null {
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try {
      return JSON.parse(t) as Record<string, unknown>;
    } catch {
      // keep looking
    }
  }
  return null;
}

function buildComment(envelope: Record<string, unknown>, sha: string | null): string {
  const data = (envelope.data ?? {}) as Record<string, unknown>;
  const lines: string[] = ['## Drift\n'];

  const packages = data.packages as
    | Array<{ name: string; exports: number; coverage: number; lintIssues: number }>
    | undefined;
  if (packages) {
    lines.push('| Package | Exports | Coverage | Lint |');
    lines.push('|---------|---------|----------|------|');
    for (const r of packages) {
      lines.push(`| ${r.name} | ${r.exports} | ${r.coverage}% | ${r.lintIssues} |`);
    }
    lines.push('');
  } else if (data.coverage && data.lint) {
    const cov = data.coverage as { score: number; documented: number; total: number };
    const lint = data.lint as { count: number };
    lines.push('| Coverage | Lint |');
    lines.push('|----------|------|');
    lines.push(`| ${cov.score}% (${cov.documented}/${cov.total}) | ${lint.count} |`);
    lines.push('');
  }

  const docs = data.docsCoverage as
    | { pass: boolean; pages: Array<{ page: string; status: string; type: string }> }
    | undefined;
  if (docs?.pages?.length) {
    lines.push('| Page | Type | Status |');
    lines.push('|------|------|--------|');
    for (const p of docs.pages) {
      lines.push(`| ${p.page} | ${p.type} | ${p.status} |`);
    }
    lines.push('');
  }

  const pass = data.pass !== false;
  lines.push(pass ? '**Passed.**' : '**Failed.**');
  lines.push('');
  lines.push('---');
  const ts = new Date().toISOString();
  lines.push(`*[Drift](https://github.com/ryanwaits/drift) · ${ts}${sha ? ` · ${sha}` : ''}*`);
  return lines.join('\n');
}

async function postComment(repo: string, pr: number, token: string, body: string): Promise<void> {
  const fullBody = `${marker}\n${body}`;
  const apiBase = `https://api.github.com/repos/${repo}/issues/${pr}/comments`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
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
  await fetch(apiBase, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: fullBody }),
  });
}

const file = process.argv[2];
if (!file || !existsSync(file)) process.exit(0);

const raw = readFileSync(file, 'utf-8');
const envelope = parseEnvelope(raw);
if (!envelope) process.exit(0);

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) {
  appendFileSync(summary, `${buildComment(envelope, process.env.GITHUB_SHA?.slice(0, 7) ?? null)}\n`);
}

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const eventPath = process.env.GITHUB_EVENT_PATH;
if (!token || !repo || !eventPath || !existsSync(eventPath)) process.exit(0);

let pr: number | null = null;
try {
  const event = JSON.parse(readFileSync(eventPath, 'utf-8'));
  pr = event.pull_request?.number ?? null;
} catch {
  process.exit(0);
}
if (!pr) process.exit(0);

await postComment(repo, pr, token, buildComment(envelope, process.env.GITHUB_SHA?.slice(0, 7) ?? null));
