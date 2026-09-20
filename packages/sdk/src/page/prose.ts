import type { ApiSpec } from '../analysis/api-spec';
import type { ExportRegistry } from '../analysis/drift/types';
import { FENCE, HEADING, indexToPos, isDistinctiveApiName, unwrapApiToken } from './locators';
import { resolveApiName, specRefKey } from './spec-ref';
import type { SourcePos, SpecRef } from './types';

const BACKTICK: RegExp = /`([^`\n]+)`/g;
const QUALIFIED_G: RegExp = /([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g;
const IDENT: RegExp = /^[A-Za-z_$][\w$]*$/;
const IMPORT_LINE: RegExp = /^\s*import\s/;
const LIST_ITEM: RegExp = /^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/;
const TABLE_ROW: RegExp = /^\s*\|/;

export type ProseHit = {
  text: string;
  specRef: SpecRef;
  start: SourcePos;
  end: SourcePos;
};

type Span = { text: string; start: number; end: number };

function escapeRe(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitSentences(text: string, base: number): Span[] {
  const units: Span[] = [];
  let i = 0;
  while (i < text.length && /\s/.test(text[i])) i++;
  let start = i;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (
      (ch === '.' || ch === '!' || ch === '?') &&
      (i + 1 === text.length || /\s/.test(text[i + 1]))
    ) {
      const end = i + 1;
      units.push({ text: text.slice(start, end), start: base + start, end: base + end });
      i++;
      while (i < text.length && /\s/.test(text[i])) i++;
      start = i;
      i--;
    }
  }
  if (start < text.length) {
    const slice = text.slice(start).trimEnd();
    if (slice.trim()) {
      units.push({ text: slice, start: base + start, end: base + start + slice.length });
    }
  }
  return units;
}

function isTableSep(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell.trim());
}

function extractUnits(content: string): Span[] {
  const units: Span[] = [];
  const lines = content.split('\n');
  let offset = 0;
  let inFence = false;
  let para: { start: number; end: number } | null = null;

  const flushPara = (): void => {
    if (!para) return;
    units.push(...splitSentences(content.slice(para.start, para.end), para.start));
    para = null;
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineStart = offset;
    const lineEnd = offset + line.length;
    offset = lineEnd + (li < lines.length - 1 ? 1 : 0);

    if (FENCE.test(line)) {
      flushPara();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (HEADING.test(line) || IMPORT_LINE.test(line)) {
      flushPara();
      continue;
    }
    if (TABLE_ROW.test(line)) {
      flushPara();
      const cells = line.split('|');
      let cellOffset = lineStart;
      for (let ci = 0; ci < cells.length; ci++) {
        const cell = cells[ci];
        const cellStart = cellOffset;
        cellOffset = cellStart + cell.length + 1;
        const trimmed = cell.trim();
        if (!trimmed || isTableSep(trimmed)) continue;
        const lead = cell.length - cell.trimStart().length;
        const innerStart = cellStart + lead;
        units.push({ text: trimmed, start: innerStart, end: innerStart + trimmed.length });
      }
      continue;
    }
    const list = line.match(LIST_ITEM);
    if (list) {
      flushPara();
      const innerStart = lineStart + list[1].length;
      units.push(...splitSentences(list[2], innerStart));
      continue;
    }
    if (!line.trim()) {
      flushPara();
      continue;
    }
    if (!para) para = { start: lineStart, end: lineEnd };
    else para.end = lineEnd;
  }
  flushPara();
  return units;
}

function refsInText(text: string, spec: ApiSpec, registry: ExportRegistry): SpecRef[] {
  const found = new Map<string, SpecRef>();
  const add = (ref: SpecRef | null): void => {
    if (!ref) return;
    const key = specRefKey(ref);
    if (key) found.set(key, ref);
  };

  for (const m of text.matchAll(BACKTICK)) {
    add(resolveApiName(spec, registry, unwrapApiToken(m[1])));
  }
  for (const m of text.matchAll(QUALIFIED_G)) {
    add(resolveApiName(spec, registry, `${m[1]}.${m[2]}`));
  }
  for (const name of registry.all) {
    if (!IDENT.test(name) || !isDistinctiveApiName(name)) continue;
    const re = new RegExp(`(?<![A-Za-z0-9_$])${escapeRe(name)}(?![A-Za-z0-9_$])`);
    if (re.test(text)) add(resolveApiName(spec, registry, name));
  }
  return [...found.values()];
}

/**
 * Sentences, list items, and table cells outside fences that name an export
 * or `Type.member`. One hit per distinct specRef in the unit.
 */
export function findProseHits(
  content: string,
  spec: ApiSpec,
  registry: ExportRegistry,
): ProseHit[] {
  const hits: ProseHit[] = [];
  for (const unit of extractUnits(content)) {
    if (!unit.text.trim()) continue;
    const refs = refsInText(unit.text, spec, registry);
    if (refs.length === 0) continue;
    const start = indexToPos(content, unit.start);
    const end = indexToPos(content, Math.max(unit.start, unit.end - 1));
    for (const specRef of refs) {
      hits.push({ text: unit.text, specRef, start, end });
    }
  }
  return hits;
}
