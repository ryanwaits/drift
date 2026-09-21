import type { ApiSpec } from '../analysis/api-spec';
import type { ExportRegistry } from '../analysis/drift/types';
import {
  fencedLines,
  HEADING,
  headingAncestorNames,
  indexToPos,
  isApiToken,
  isBuiltinName,
  isDistinctiveApiName,
  isMemberToken,
  type PageHeading,
  unwrapApiToken,
} from './locators';
import { resolveApiName, resolveMemberName, specRefKey } from './spec-ref';
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
  const fenced = fencedLines(lines);
  let offset = 0;
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

    if (fenced[li]) {
      flushPara();
      continue;
    }
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

function ancestorPreferred(
  registry: ExportRegistry,
  headings: PageHeading[],
  line: number,
): Set<string> | undefined {
  const preferred = new Set<string>();
  for (const name of headingAncestorNames(headings, line)) {
    if (registry.all.has(name) || registry.typeNames.includes(name)) preferred.add(name);
  }
  return preferred.size > 0 ? preferred : undefined;
}

function refsInText(
  text: string,
  spec: ApiSpec,
  registry: ExportRegistry,
  preferred?: Set<string>,
  namespaces?: ReadonlySet<string>,
): SpecRef[] {
  const found = new Map<string, SpecRef>();
  const add = (ref: SpecRef | null): void => {
    if (!ref) return;
    const key = specRefKey(ref);
    if (key) found.set(key, ref);
  };

  for (const m of text.matchAll(BACKTICK)) {
    if (!isApiToken(m[1])) continue;
    const name = unwrapApiToken(m[1]);
    add(
      isMemberToken(m[1])
        ? resolveMemberName(spec, registry, name, preferred)
        : resolveApiName(spec, registry, name, preferred, namespaces),
    );
  }
  for (const m of text.matchAll(QUALIFIED_G)) {
    add(resolveApiName(spec, registry, `${m[1]}.${m[2]}`, undefined, namespaces));
  }
  for (const name of [...registry.all, ...(registry.localNames?.keys() ?? [])]) {
    if (!IDENT.test(name) || !isDistinctiveApiName(name) || isBuiltinName(name)) continue;
    // `x.safeParse` is a member of `x`, never the top-level export `safeParse`.
    const re = new RegExp(`(?<![A-Za-z0-9_$.])${escapeRe(name)}(?![A-Za-z0-9_$])`);
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
  headings: PageHeading[] = [],
  namespaces?: ReadonlySet<string>,
): ProseHit[] {
  const hits: ProseHit[] = [];
  for (const unit of extractUnits(content)) {
    if (!unit.text.trim()) continue;
    const start = indexToPos(content, unit.start);
    const refs = refsInText(
      unit.text,
      spec,
      registry,
      ancestorPreferred(registry, headings, start.line),
      namespaces,
    );
    if (refs.length === 0) continue;
    const end = indexToPos(content, Math.max(unit.start, unit.end - 1));
    for (const specRef of refs) {
      hits.push({ text: unit.text, specRef, start, end });
    }
  }
  return hits;
}
