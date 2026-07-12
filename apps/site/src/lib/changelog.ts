import fs from 'node:fs';
import path from 'node:path';

/**
 * Auto-populates from the real changesets-generated CHANGELOG.md — never
 * hand-curated. New releases show up here automatically after `bun run version`.
 */
const CHANGELOG_PATH = path.join(process.cwd(), '../../packages/cli/CHANGELOG.md');

export type ChangelogBullet = {
  kind: 'major' | 'minor' | 'patch';
  text: string;
};

export type ChangelogEntry = {
  version: string;
  bullets: ChangelogBullet[];
};

const NOISE_RE = /^Updated dependencies(\s*\[[0-9a-f]+\])?\s*$/i;
const HASH_PREFIX_RE = /^[0-9a-f]{7,10}:\s*/;

function parseSection(sectionBody: string, kind: ChangelogBullet['kind']): ChangelogBullet[] {
  const bullets: ChangelogBullet[] = [];
  const chunks = sectionBody.split(/\n(?=- )/g);
  for (const chunk of chunks) {
    const withoutDash = chunk.replace(/^-\s*/, '');
    const text = withoutDash.trim();
    if (!text) continue;
    const firstLine = text.split('\n')[0].trim();
    if (NOISE_RE.test(firstLine)) continue;
    bullets.push({ kind, text: text.replace(HASH_PREFIX_RE, '') });
  }
  return bullets;
}

let cache: ChangelogEntry[] | null = null;

/** Newest first — the source file is already ordered this way by changesets. */
export function getChangelogEntries(): ChangelogEntry[] {
  if (cache) return cache;

  const raw = fs.readFileSync(CHANGELOG_PATH, 'utf-8');
  const versionBlocks = raw.split(/^## /m).slice(1);

  const entries: ChangelogEntry[] = [];

  for (const block of versionBlocks) {
    const lines = block.split('\n');
    const version = lines[0].trim();
    const body = lines.slice(1).join('\n');

    const bullets: ChangelogBullet[] = [];
    const sections = body.split(/^### /m).slice(1);
    for (const section of sections) {
      const sectionLines = section.split('\n');
      const title = sectionLines[0].trim().toLowerCase();
      const sectionBody = sectionLines.slice(1).join('\n');
      if (title.startsWith('major')) bullets.push(...parseSection(sectionBody, 'major'));
      else if (title.startsWith('minor')) bullets.push(...parseSection(sectionBody, 'minor'));
      else if (title.startsWith('patch')) bullets.push(...parseSection(sectionBody, 'patch'));
    }

    if (bullets.length > 0) {
      entries.push({ version, bullets });
    }
  }

  cache = entries;
  return entries;
}

export function getChangelogPage(
  page: number,
  perPage = 5,
): { entries: ChangelogEntry[]; totalPages: number; page: number } {
  const all = getChangelogEntries();
  const totalPages = Math.max(1, Math.ceil(all.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return { entries: all.slice(start, start + perPage), totalPages, page: safePage };
}
