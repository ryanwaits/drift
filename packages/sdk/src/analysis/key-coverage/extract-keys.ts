/**
 * Deterministic documented-key extraction from markdown/MDX docs pages.
 *
 * Line-based on purpose: GFM tables aren't parsed by plain remark, and the
 * line rules below are the ones proven on the posthog.com corpus (linked
 * cells, dotted sub-keys, <br/>-embedded keys, heading-level-aware section
 * exit). "Documented" = backticked key in the first cell of a table row
 * inside a section whose heading matches sectionRe.
 */

import type { DocsKeyCorpus, DocumentedKeyLocation } from './types';

const IDENT = /^[A-Za-z_$][\w$]*$/;
const HEADING = /^(#{1,6})\s+(.*)/;
const FENCE = /^\s*(```|~~~)/;
const BACKTICK_TOKEN = /`([^`\n]+)`/g;

export const DEFAULT_SECTION_RE: RegExp = /option|config/i;

/** Normalize a backticked token to a candidate key: dotted → prefix. */
function toKey(raw: string): string | null {
  const key = raw.split('.')[0].trim();
  return IDENT.test(key) ? key : null;
}

/**
 * Extract documented option keys from a docs corpus.
 *
 * @param files - Corpus pages (path + raw content)
 * @param sectionRe - Heading regex that opens an options section (default /option|config/i)
 */
export function extractDocumentedKeys(
  files: Array<{ path: string; content: string }>,
  sectionRe: RegExp = DEFAULT_SECTION_RE,
): DocsKeyCorpus {
  const documented = new Map<string, DocumentedKeyLocation[]>();
  const inlineMentions = new Set<string>();
  let text = '';

  for (const file of files) {
    text += `\n${file.content}`;
    let inSection = false;
    let sectionLevel = 0;
    let sectionName = '';
    let inFence = false;

    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Fenced code toggles; fence contents are invisible to heading/table
      // tracking (a bash `# comment` must not end a section) but still count
      // toward mentions via the raw corpus text.
      if (FENCE.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      // Inline mentions: every backticked identifier outside fences
      for (const m of line.matchAll(BACKTICK_TOKEN)) {
        const key = toKey(m[1]);
        if (key) inlineMentions.add(key);
      }

      const h = line.match(HEADING);
      if (h) {
        const level = h[1].length;
        if (inSection && level <= sectionLevel) inSection = false;
        if (sectionRe.test(h[2])) {
          inSection = true;
          sectionLevel = level;
          sectionName = h[2].trim();
        }
        continue;
      }
      if (!inSection) continue;

      // Table row: the FIRST backticked token of the first cell is the key
      // (covers plain `key`, linked [`key`](…), and keys after a leading
      // <br/>). Only the first token — later tokens in the same cell are
      // value literals (`true`, `'always'`) and harvesting them fabricates
      // ghosts (proven on the posthog.com corpus).
      if (!/^\s*\|/.test(line)) continue;
      const firstCell = line.replace(/^\s*\|/, '').split('|')[0] ?? '';
      if (/^[\s:-]+$/.test(firstCell)) continue; // separator row
      const first = firstCell.match(/`([^`\n]+)`/);
      if (first) {
        const key = toKey(first[1]);
        if (key) {
          const locs = documented.get(key) ?? [];
          locs.push({ file: file.path, line: i + 1, section: sectionName, raw: first[1] });
          documented.set(key, locs);
        }
      }
    }
  }

  return { documented, inlineMentions, text };
}
