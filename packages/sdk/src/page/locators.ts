import type { Locator, SourcePos } from './types';

/** github-slugger punctuation strip (hyphen/underscore kept). */
const SLUG_PUNCT: RegExp = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g;

export const HEADING: RegExp = /^(#{1,6})\s+(.*)$/;
export const FENCE: RegExp = /^\s*(```|~~~)/;
const FENCE_OPEN: RegExp = /^\s*(?:>\s*)*(`{3,}|~{3,})(.*)$/;

/**
 * Per line: true for a fence marker line and for every line inside a fenced
 * code block. A fence closes only on its own marker character, at least as
 * long as the opener, with no info string; an unclosed fence runs to the end.
 * Every line-by-line markdown scan goes through this.
 */
export function fencedLines(lines: readonly string[]): boolean[] {
  const fenced: boolean[] = new Array(lines.length).fill(false);
  let open: { char: string; length: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(FENCE_OPEN);
    if (open) {
      fenced[i] = true;
      if (m && m[1][0] === open.char && m[1].length >= open.length && !m[2].trim()) open = null;
      continue;
    }
    // A backtick fence's info string has no backtick: that is an inline code span.
    if (!m || (m[1][0] === '`' && m[2].includes('`'))) continue;
    open = { char: m[1][0], length: m[1].length };
    fenced[i] = true;
  }
  return fenced;
}

export type PageHeading = {
  line: number;
  level: number;
  text: string;
  id: string;
  /** Column of the first heading-text character (1-indexed) */
  textCol: number;
  endCol: number;
};

/** GitHub/Fumadocs heading slug, occurrence-aware per page. */
export class PageSlugger {
  private readonly seen: Map<string, number> = new Map();

  slug(value: string): string {
    const base = value.toLowerCase().replace(SLUG_PUNCT, '').replace(/ /g, '-');
    const n = this.seen.get(base) ?? 0;
    this.seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  }
}

/** Unwrap markdown in a heading: backticks, links. */
export function unwrapHeadingText(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/** Strip trailing `()` from a heading used as an API name. */
export function normalizeApiName(text: string): string {
  return unwrapHeadingText(text)
    .replace(/\(\s*\)\s*$/, '')
    .trim();
}

/**
 * Backticked API token without call/type args: `joinRoom(roomId, options)` → `joinRoom`.
 * A leading dot (`.start()`) is stripped so heading-scoped `.member` counts.
 */
export function unwrapApiToken(text: string): string {
  let s = unwrapHeadingText(text).trim();
  for (let i = 0; i < 4; i++) {
    const next = s
      .replace(/<[^<>]*>\s*$/, '')
      .replace(/\([^)]*\)\s*$/, '')
      .trim();
    if (next === s) break;
    s = next;
  }
  return s.replace(/^\./, '');
}

/**
 * Bare-word matchable: camelCase with an inner capital (`useSWR`), PascalCase
 * with 2+ humps (`ZodType`, `SWRConfig`), or snake_case. Dictionary-plain
 * names (`Room`, `atom`), names that only carry a digit (`base64`, `utf8`,
 * `h1`) and acronyms (`JSON`, `URL`) are English until backticked.
 */
export function isDistinctiveApiName(name: string): boolean {
  if (!name) return false;
  if (/[A-Za-z0-9]_[A-Za-z0-9]/.test(name)) return true;
  if (/[a-z][A-Z]/.test(name)) return true;
  return /^[A-Z]/.test(name) && /[a-z]/.test(name) && /[A-Z].*[A-Z]/.test(name);
}

export function indexToPos(content: string, index: number): SourcePos {
  const before = content.slice(0, index);
  const lastNl = before.lastIndexOf('\n');
  return {
    line: before.split('\n').length,
    col: index - lastNl,
  };
}

export function lineRange(content: string, line: number): { start: number; text: string } | null {
  if (line < 1) return null;
  let start = 0;
  let current = 1;
  while (current < line) {
    const nl = content.indexOf('\n', start);
    if (nl === -1) return null;
    start = nl + 1;
    current++;
  }
  const nl = content.indexOf('\n', start);
  const text = nl === -1 ? content.slice(start) : content.slice(start, nl);
  return { start, text };
}

/**
 * Locate `span` in source. Prefers the occurrence nearest `hintLine` (1-indexed).
 */
export function locateSpan(
  content: string,
  span: string,
  hintLine?: number,
): { start: SourcePos; end: SourcePos } | null {
  if (!span) return null;
  if (hintLine !== undefined) {
    const row = lineRange(content, hintLine);
    if (row) {
      const col = row.text.indexOf(span);
      if (col !== -1) {
        const startIdx = row.start + col;
        return {
          start: indexToPos(content, startIdx),
          end: indexToPos(content, startIdx + span.length - 1),
        };
      }
    }
  }
  const idx = content.indexOf(span);
  if (idx === -1) return null;
  return {
    start: indexToPos(content, idx),
    end: indexToPos(content, idx + span.length - 1),
  };
}

/** Locate a token on a specific 1-indexed line. */
export function locateOnLine(
  content: string,
  line: number,
  token: string,
): { start: SourcePos; end: SourcePos } | null {
  const row = lineRange(content, line);
  if (!row) return null;
  const col = row.text.indexOf(token);
  if (col === -1) return null;
  return {
    start: { line, col: col + 1 },
    end: { line, col: col + token.length },
  };
}

/** A fenced code block: `lineStart` is the opening fence line (1-indexed), `code` its dedented value. */
export type FenceBlock = { code: string; lineStart: number; lineEnd: number };

/**
 * Column where fence code line `codeText` starts on its markdown line `row`.
 * The parser strips list / blockquote indentation from the code value.
 */
function fenceIndent(row: string, codeText: string): number | null {
  if (row.endsWith(codeText)) return row.length - codeText.length;
  const trimmed = codeText.trim();
  const at = trimmed ? row.indexOf(trimmed) : -1;
  return at === -1 ? null : at - (codeText.length - codeText.trimStart().length);
}

/**
 * Source position of `span`, which starts at 0-indexed `codeLine`:`codeCol` of
 * `block.code`. Code line 0 is the line after the opening fence. When that
 * position does not hold the span, the nearest occurrence inside the fence;
 * never a position outside it.
 */
export function locateInFence(
  content: string,
  block: FenceBlock,
  span: string,
  codeLine: number,
  codeCol: number,
): { start: SourcePos; end: SourcePos } | null {
  const spanLines = span.split('\n');
  const first = spanLines[0];
  if (!first) return null;
  const codeLines = block.code.split('\n');
  const firstCode = block.lineStart + 1;
  const indentAt = (line: number): number | null => {
    const row = lineRange(content, line);
    const code = codeLines[line - firstCode];
    return row && code !== undefined ? fenceIndent(row.text, code) : null;
  };

  let start: SourcePos | null = null;
  const hinted = firstCode + codeLine;
  const indent = indentAt(hinted);
  if (indent !== null) {
    const col = indent + codeCol;
    if (col >= 0 && lineRange(content, hinted)?.text.startsWith(first, col)) {
      start = { line: hinted, col: col + 1 };
    }
  }
  if (!start) {
    const lines: number[] = [];
    for (let line = firstCode; line <= block.lineEnd; line++) lines.push(line);
    lines.sort((a, b) => Math.abs(a - hinted) - Math.abs(b - hinted));
    for (const line of lines) {
      const found = locateOnLine(content, line, first);
      if (found) {
        start = found.start;
        break;
      }
    }
  }
  if (!start) return null;

  const firstEnd = { line: start.line, col: start.col + first.length - 1 };
  if (spanLines.length === 1) return { start, end: firstEnd };
  // Later span lines are whole code lines from their first column.
  const endLine = start.line + spanLines.length - 1;
  const endIndent = indentAt(endLine);
  const last = spanLines[spanLines.length - 1];
  if (endIndent === null || endLine > block.lineEnd) return { start, end: firstEnd };
  return { start, end: { line: endLine, col: Math.max(1, endIndent + last.length) } };
}

export function collectHeadings(content: string): PageHeading[] {
  const slugger = new PageSlugger();
  const headings: PageHeading[] = [];
  const lines = content.split('\n');
  const fenced = fencedLines(lines);
  for (let i = 0; i < lines.length; i++) {
    if (fenced[i]) continue;
    const m = lines[i].match(HEADING);
    if (!m) continue;
    const raw = m[2].trim();
    const text = unwrapHeadingText(raw);
    const prefix = m[1].length + 1; // hashes + space; first text col
    headings.push({
      line: i + 1,
      level: m[1].length,
      text,
      id: slugger.slug(text),
      textCol: prefix + 1,
      endCol: prefix + raw.length,
    });
  }
  return headings;
}

export function nearestHeading(headings: PageHeading[], line: number): PageHeading | undefined {
  let best: PageHeading | undefined;
  for (const h of headings) {
    if (h.line <= line) best = h;
    else break;
  }
  return best;
}

/**
 * Headings that enclose `line`, nearest first: walk up past `#### Methods`
 * to `## LiveList` to `# Storage`. Sibling sections are not ancestors.
 */
export function headingAncestors(headings: PageHeading[], line: number): PageHeading[] {
  const out: PageHeading[] = [];
  let maxLevel = Number.POSITIVE_INFINITY;
  for (let i = headings.length - 1; i >= 0; i--) {
    const h = headings[i];
    if (h.line > line) continue;
    if (h.level < maxLevel) {
      out.push(h);
      maxLevel = h.level;
      if (h.level === 1) break;
    }
  }
  return out;
}

export function headingAncestorNames(headings: PageHeading[], line: number): string[] {
  return headingAncestors(headings, line).map((h) => normalizeApiName(h.text));
}

/**
 * Text a mention on `line` answers to: its nearest heading's whole section
 * (subsections included), the intro under each enclosing heading, and the
 * preamble/frontmatter. A mention in the preamble or directly under the H1
 * takes the whole page. Sibling sections are never included.
 */
export function sectionText(content: string, headings: PageHeading[], line: number): string {
  const nearest = nearestHeading(headings, line);
  if (!nearest || nearest.level === 1) return content;
  const lines = content.split('\n');
  const nextLine = (from: PageHeading, maxLevel: number): number =>
    headings.find((h) => h.line > from.line && h.level <= maxLevel)?.line ?? lines.length + 1;
  const parts = [lines.slice(0, (headings[0]?.line ?? 1) - 1)];
  for (const h of headingAncestors(headings, line)) {
    const end = h === nearest ? nextLine(h, h.level) : nextLine(h, 6);
    parts.push(lines.slice(h.line - 1, end - 1));
  }
  return parts.map((p) => p.join('\n')).join('\n');
}

export function attachHeading(
  locator: Omit<Locator, 'headingId' | 'headingText'>,
  headings: PageHeading[],
): Locator {
  const h = nearestHeading(headings, locator.start.line);
  if (!h) return locator;
  return { ...locator, headingId: h.id, headingText: h.text };
}

export function headingLocator(path: string, heading: PageHeading): Locator {
  return {
    path,
    start: { line: heading.line, col: heading.textCol },
    end: { line: heading.line, col: heading.endCol },
    headingId: heading.id,
    headingText: heading.text,
  };
}

export function pageTitle(headings: PageHeading[]): string | undefined {
  return headings.find((h) => h.level === 1)?.text;
}

export function isFenceLine(line: string): boolean {
  return FENCE.test(line);
}
