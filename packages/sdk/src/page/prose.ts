import type { ApiSpec } from '../analysis/api-spec';
import type { ExportRegistry } from '../analysis/drift/types';
import { levenshtein } from '../analysis/drift/utils';
import { closedObjectShape } from './call-sites';
import { isNegatedApiText } from './fences';
import {
  fencedLines,
  frontmatterTitle,
  HEADING,
  headingAncestors,
  indexToPos,
  isApiToken,
  isBuiltinName,
  isDistinctiveApiName,
  isExportContext,
  isMemberToken,
  nearestHeading,
  type PageHeading,
  unwrapApiToken,
} from './locators';
import {
  preferredParents,
  resolveApiName,
  resolveMemberName,
  signaturesOf,
  specRefKey,
} from './spec-ref';
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

function refsInText(
  text: string,
  spec: ApiSpec,
  registry: ExportRegistry,
  preferred?: Set<string>,
  namespaces?: ReadonlySet<string>,
  section?: { ancestors: readonly PageHeading[]; title?: string },
): SpecRef[] {
  const found = new Map<string, SpecRef>();
  const add = (ref: SpecRef | null): void => {
    if (!ref) return;
    const key = specRefKey(ref);
    if (key) found.set(key, ref);
  };

  for (const m of text.matchAll(BACKTICK)) {
    const after = text.slice((m.index ?? 0) + m[0].length);
    const ancestors = section?.ancestors ?? [];
    // A builtin name is never a member by context: the export, or the language's.
    const isExport =
      registry.all.has(m[1]) && isExportContext(m[1], { ...section, ancestors, after });
    if (!isApiToken(m[1]) && !isExport) continue;
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
  /** Types the whole page is about: a bare member name may be theirs */
  pageTypes: Iterable<string> = [],
): ProseHit[] {
  const hits: ProseHit[] = [];
  const title = frontmatterTitle(content);
  for (const unit of extractUnits(content)) {
    if (!unit.text.trim()) continue;
    const start = indexToPos(content, unit.start);
    const refs = refsInText(
      unit.text,
      spec,
      registry,
      preferredParents(registry, headings, start.line, pageTypes),
      namespaces,
      { ancestors: headingAncestors(headings, start.line), title },
    );
    if (refs.length === 0) continue;
    const end = indexToPos(content, Math.max(unit.start, unit.end - 1));
    for (const specRef of refs) {
      hits.push({ text: unit.text, specRef, start, end });
    }
  }
  return hits;
}

export type ProseOptionHit = {
  type: 'prose-unknown-key';
  issue: string;
  suggestion: string;
  exportName: string;
  /** The key as written, without backticks */
  text: string;
  /** Span of the backticked key */
  start: SourcePos;
  end: SourcePos;
};

const OPTION_NOUN = '(?:option|parameter|setting|prop)';
/** `the \`k\` option`, `\`k\` option`, `option \`k\``: the key and where its backticked token starts. */
const OPTION_PHRASE: RegExp = new RegExp(
  `\`([A-Za-z_$][\\w$]*)\`\\s+${OPTION_NOUN}\\b|\\b${OPTION_NOUN}\\s+\`([A-Za-z_$][\\w$]*)\``,
  'gi',
);
/** `... option of \`providerOptions\``: the key belongs to a nested object, not to the export. */
const NESTED_AFTER: RegExp = /^\s+(?:of|in|on|inside|within|under)\s+(?:the\s+)?`([^`\n]+)`/i;
/** `... option for \`streamText\``: the export the phrase belongs to, named right after it. */
const OWNER_AFTER: RegExp = /^\s+(?:of|for|on|to)\s+(?:the\s+)?`([^`\n]+)`/i;
const NEAR_MISS_DISTANCE = 2;
const EXPORT_TOKEN: RegExp = /^([A-Za-z_$][\w$]*)$/;
const JSX_TOKEN: RegExp = /^<\s*([A-Za-z_$][\w$]*)(?:\s[^<>]*)?\/?>$/;

/**
 * The one closed options object (or props) of a callable: every overload
 * with parameters takes exactly one, a closed object. Keys are the union
 * across overloads. Null for anything else.
 */
function soleOptionsShape(spec: ApiSpec, exportName: string): Set<string> | null {
  const sigs = signaturesOf(spec, exportName);
  if (sigs.length === 0) return null;
  const keys = new Set<string>();
  let any = false;
  for (const sig of sigs) {
    const params = sig.parameters ?? [];
    if (params.length === 0) continue;
    if (params.length > 1) return null;
    const shape = closedObjectShape(spec, params[0].schema);
    if (!shape) return null;
    any = true;
    for (const k of shape.keys) keys.add(k);
  }
  return any && keys.size > 0 ? keys : null;
}

/** Exports a sentence names in backticks (`` `useChat` ``, `` `useChat()` ``, `` `<Chat>` ``), by position. */
function namedExports(
  text: string,
  registry: ExportRegistry,
): Array<{ name: string; index: number }> {
  const found: Array<{ name: string; index: number }> = [];
  for (const m of text.matchAll(BACKTICK)) {
    const raw = m[1].trim();
    const id = raw.match(JSX_TOKEN)?.[1] ?? unwrapApiToken(raw).match(EXPORT_TOKEN)?.[1];
    if (!id || !registry.all.has(id) || registry.exports.get(id)?.kind === 'namespace') continue;
    if (!found.some((f) => f.name === id)) found.push({ name: id, index: m.index ?? 0 });
  }
  return found;
}

/**
 * `prose-unknown-key` for prose: a sentence that names one export in
 * backticks and calls `k` its option / parameter / setting / prop, where
 * `k` is not a key of that export's one closed options object (or props).
 * The export is named before the phrase, or right after it (`option for
 * \`streamText\``). Silent for open shapes, multi-parameter callables,
 * sentences naming several exports, keys said to sit inside another option,
 * and sentences or headings that negate the API (`has been removed`).
 */
export function findProseOptionHits(
  content: string,
  spec: ApiSpec,
  registry: ExportRegistry,
  headings: PageHeading[] = [],
): ProseOptionHit[] {
  const hits: ProseOptionHit[] = [];
  for (const unit of extractUnits(content)) {
    const phrases = [...unit.text.matchAll(OPTION_PHRASE)];
    if (phrases.length === 0) continue;
    const exports = namedExports(unit.text, registry);
    if (exports.length !== 1) continue;
    const [{ name: exportName, index: namedAt }] = exports;
    if (isNegatedApiText(unit.text)) continue;
    const start = indexToPos(content, unit.start);
    const heading = nearestHeading(headings, start.line);
    if (heading && isNegatedApiText(heading.text)) continue;
    const keys = soleOptionsShape(spec, exportName);
    if (!keys) continue;
    for (const m of phrases) {
      const key = m[1] ?? m[2];
      if (!key || key === exportName || keys.has(key)) continue;
      const at = unit.text.indexOf(`\`${key}\``, m.index ?? 0);
      if (at === -1) continue;
      const after = unit.text.slice((m.index ?? 0) + m[0].length);
      const parent = after.match(NESTED_AFTER)?.[1];
      if (parent && keys.has(unwrapApiToken(parent))) continue;
      const ownerAfter = after.match(OWNER_AFTER)?.[1];
      const owned =
        namedAt < at || (ownerAfter !== undefined && unwrapApiToken(ownerAfter) === exportName);
      if (!owned) continue;
      const allowed = [...keys].sort();
      const near = allowed
        .map((name) => ({ name, d: levenshtein(key.toLowerCase(), name.toLowerCase()) }))
        .filter((n) => n.d <= NEAR_MISS_DISTANCE)
        .sort((a, b) => a.d - b.d)[0];
      hits.push({
        type: 'prose-unknown-key',
        issue: `'${key}' is not an option of '${exportName}'`,
        suggestion: near ? `Did you mean '${near.name}'?` : `Allowed: ${allowed.join(', ')}`,
        exportName,
        text: key,
        start: indexToPos(content, unit.start + at),
        end: indexToPos(content, unit.start + at + key.length + 1),
      });
    }
  }
  return hits;
}
