import fs from 'node:fs';
import path from 'node:path';
import GithubSlugger from 'github-slugger';

const DOCS_DIR = path.join(process.cwd(), '../../docs');

export type DocMeta = {
  slug: string;
  title: string;
};

export type DocHeading = {
  id: string;
  text: string;
  depth: 2 | 3;
};

function titleFromContent(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

export function getDocSlugs(): string[] {
  return fs
    .readdirSync(DOCS_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''));
}

export function getDocContent(slug: string): string {
  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  return fs.readFileSync(filePath, 'utf-8');
}

export function getDocMeta(slug: string): DocMeta {
  const content = getDocContent(slug);
  return { slug, title: titleFromContent(content, slug) };
}

export function getAllDocsMeta(): DocMeta[] {
  return getDocSlugs()
    .map((slug) => getDocMeta(slug))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Extracts h2/h3 headings for an on-page TOC. Ids are generated the same way
 * rehype-slug generates them (same underlying github-slugger, same document
 * order, including h1 in the counter) so `#id` links always match.
 */
export function getDocHeadings(content: string): DocHeading[] {
  const slugger = new GithubSlugger();
  const headings: DocHeading[] = [];
  let inCodeBlock = false;

  for (const line of content.split('\n')) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (!match) continue;

    const level = match[1].length;
    // Strip inline-code backticks so this matches the *rendered* text rehype-slug
    // actually sees (a code span's backticks aren't part of the text content).
    const text = match[2].trim().replace(/`/g, '');
    const id = slugger.slug(text);

    if (level === 2 || level === 3) {
      headings.push({ id, text, depth: level as 2 | 3 });
    }
  }

  return headings;
}

/**
 * Resolves a real `/docs/<slug>#<id>` link by finding the heading whose text
 * matches `headingText` (case-insensitive). Falls back to the doc's root if
 * no heading matches, so a stale reference degrades instead of 404ing.
 */
export function getDocAnchor(slug: string, headingText: string): string {
  const content = getDocContent(slug);
  const headings = getDocHeadings(content);
  const match = headings.find((h) => h.text.toLowerCase() === headingText.toLowerCase());
  return match ? `/docs/${slug}#${match.id}` : `/docs/${slug}`;
}
