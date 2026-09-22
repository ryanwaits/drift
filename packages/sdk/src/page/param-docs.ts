import type { ApiSchema, ApiSignature, ApiSpec } from '../analysis/api-spec';
import type { ExportRegistry } from '../analysis/drift/types';
import { closedObjectShape } from './call-sites';
import { splitTopLevel } from './fences';
import {
  FENCE,
  fencedLines,
  HEADING,
  headingAncestors,
  nearestHeading,
  type PageHeading,
} from './locators';
import { signaturesOf } from './spec-ref';

export type ParamDocHit = {
  type: 'prose-param-mismatch';
  issue: string;
  suggestion?: string;
  exportName: string;
  /** Key as written, without backticks (`options.mode`) */
  text: string;
  /** Span to locate on `line`: the backticked token when the key is backticked */
  span: string;
  /** 1-indexed markdown line */
  line: number;
};

const IDENT = '[A-Za-z_$][\\w$]*';
const IDENT_RE: RegExp = new RegExp(`^${IDENT}$`);
const DOTTED_RE: RegExp = new RegExp(`^(${IDENT})\\.(${IDENT})$`);
/** First header cell of a parameter table. `names` are positional; `keys` may be object properties. */
const HEADER_RE: RegExp = /^(?:(param|parameter|argument|arg)|(name|prop|property|option))s?$/i;
const PROPERTIES_RE: RegExp = /^properties$/i;
/** Headings the owner walk may pass through: they scope a table, they never re-target it. */
const NEUTRAL_HEADING: RegExp =
  /^(?:api(?: reference)?|reference|usage|signature|syntax|parameters?|params?|arguments?|args?|props?|properties|options?|config(?:uration)?)$/i;
const PARAM_LIST_HEADING: RegExp = /^(?:parameters?|params?|arguments?|args?)$/i;
const KEYS_HEADING: RegExp = /^(?:props?|properties|options?|config(?:uration)?)$/i;
const LITERAL_PREFIX = new Set(['options', 'props']);
const PRIMITIVES = new Set(['string', 'number', 'boolean']);
const PLAIN_TYPES = new Set([
  'string',
  'number',
  'integer',
  'boolean',
  'null',
  'undefined',
  'array',
  'function',
  'bigint',
  'symbol',
]);

type Noun = { one: string; many: string };
const NOUNS: Record<string, Noun> = {
  prop: { one: 'prop', many: 'Props' },
  property: { one: 'property', many: 'Properties' },
  option: { one: 'option', many: 'Options' },
};
const PARAMETER: Noun = { one: 'parameter', many: 'Parameters' };

type Row = {
  line: number;
  /** Key without backticks, `?` stripped */
  key: string;
  span: string;
  rest: boolean;
  /** Not an identifier or `a.b` */
  prose: boolean;
  typeCell?: string;
};

type Block = {
  /** Line of the header row / first list item */
  line: number;
  mode: 'names' | 'keys';
  noun: Noun;
  rows: Row[];
};

type Owner = {
  name: string;
  signatures: ApiSignature[];
};

/** Cells of a `| a | b |` row. `\|` and pipes inside backticks are cell text. */
function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inCode = false;
  const body = line.trim().replace(/^\|/, '');
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\' && body[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (ch === '`') {
      inCode = !inCode;
      cur += ch;
    } else if (ch === '|' && !inCode) {
      cells.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) cells.push(cur.trim());
  return cells;
}

function isSeparatorRow(line: string): boolean {
  const cells = splitCells(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

function plainCell(cell: string): string {
  return cell.replace(/[`*_]/g, '').trim();
}

/** Key of a table cell or list item: the first backticked token, else the bare text. */
function readKey(cell: string, requireBackticks: boolean): Omit<Row, 'line' | 'typeCell'> | null {
  const ticked = cell.match(/`([^`\n]+)`/);
  if (!ticked && requireBackticks) return null;
  const raw = (ticked ? ticked[1] : plainCell(cell)).trim();
  if (!raw) return null;
  const rest = raw.startsWith('...');
  const key = raw.replace(/\?$/, '').trim();
  // A bare word is a parameter only when it reads like one: `Timeout` is prose.
  const shaped = IDENT_RE.test(key) || DOTTED_RE.test(key);
  const prose = !shaped || (!ticked && !/^[a-z_$]/.test(key));
  return { key, span: ticked ? `\`${ticked[1]}\`` : raw, rest, prose };
}

function headerMode(cell: string): Pick<Block, 'mode' | 'noun'> | null {
  const text = plainCell(cell);
  if (PROPERTIES_RE.test(text)) return { mode: 'keys', noun: NOUNS.property };
  const m = text.match(HEADER_RE);
  if (!m) return null;
  if (m[1]) return { mode: 'names', noun: PARAMETER };
  return { mode: 'keys', noun: NOUNS[m[2].toLowerCase()] ?? PARAMETER };
}

function collectBlocks(content: string, headings: PageHeading[]): Block[] {
  const blocks: Block[] = [];
  const lines = content.split('\n');
  const fenced = fencedLines(lines);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fenced[i]) continue;

    if (/^\s*\|/.test(line) && isSeparatorRow(lines[i + 1] ?? '')) {
      const header = splitCells(line);
      const mode = headerMode(header[0] ?? '');
      const typeCol = header.findIndex((c) => /^type$/i.test(plainCell(c)));
      const rows: Row[] = [];
      let j = i + 2;
      for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
        const cells = splitCells(lines[j]);
        const key = readKey(cells[0] ?? '', false);
        if (!key) continue;
        rows.push({ ...key, line: j + 1, ...(typeCol > 0 ? { typeCell: cells[typeCol] } : {}) });
      }
      if (mode && rows.length > 0) blocks.push({ line: i + 1, ...mode, rows });
      i = j - 1;
      continue;
    }

    const item = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (!item) continue;
    const heading = nearestHeading(headings, i + 1);
    if (!heading || !PARAM_LIST_HEADING.test(heading.text.trim())) continue;
    const end = listEnd(lines, i);
    const rows = listRows(lines, i, end, item[1].length);
    if (rows) blocks.push({ line: i + 1, mode: 'names', noun: PARAMETER, rows });
    i = end - 1;
  }
  return blocks;
}

/** First line index after the list that starts at `start` (a heading or fence ends it). */
function listEnd(lines: string[], start: number): number {
  let i = start;
  for (; i < lines.length; i++) {
    if (HEADING.test(lines[i]) || FENCE.test(lines[i])) break;
  }
  return i;
}

/** Top-level items only: nested bullets document an option's keys. Null when an item has no key. */
function listRows(lines: string[], start: number, end: number, indent: number): Row[] | null {
  const rows: Row[] = [];
  for (let i = start; i < end; i++) {
    const m = lines[i].match(/^(\s*)[-*+]\s+(.*)$/);
    if (!m || m[1].length > indent) continue;
    const lead = m[2].match(/^(?:(?:\*\*[^*]+\*\*|_[^_]+_|\([^)]*\))\s+)?(`[^`\n]+`)/);
    const key = lead ? readKey(lead[1], true) : null;
    if (!key) return null;
    rows.push({ ...key, line: i + 1 });
  }
  return rows.length > 0 ? rows : null;
}

type ApiHeading = { name: string; qualifier?: string };

/** `name`, `name()`, `name<T>(a, b)`, `new Name(opts)`, `Type.member()`, `<Name>`; else null. */
function parseApiHeading(text: string): ApiHeading | null {
  const t = text.trim();
  const jsx = t.match(new RegExp(`^<\\s*(${IDENT})\\s*/?\\s*>$`));
  if (jsx) return { name: jsx[1] };
  const m = t
    .replace(/^(?:new|function|class|const)\s+/, '')
    .match(new RegExp(`^(${IDENT})(?:\\.(${IDENT}))?\\s*([<(][\\s\\S]*[>)])?$`));
  if (!m) return null;
  return m[2] ? { qualifier: m[1], name: m[2] } : { name: m[1] };
}

function namesType(registry: ExportRegistry, heading: PageHeading, member: string): boolean {
  const api = parseApiHeading(heading.text);
  if (!api || api.qualifier) return false;
  return registry.typeMembers.get(member)?.has(api.name) === true;
}

/**
 * The one callable the block documents: the nearest enclosing heading that
 * names an export, walking up only through headings that scope parameters
 * (`Parameters`, `Options`, `API Reference`). Anything else in between
 * (`Returns`, prose, two exports) means the table is about something else.
 */
function findOwner(
  spec: ApiSpec,
  registry: ExportRegistry,
  headings: PageHeading[],
  line: number,
): Owner | null {
  const chain = headingAncestors(headings, line);
  for (let i = 0; i < chain.length; i++) {
    const heading = chain[i];
    const api = parseApiHeading(heading.text);
    if (api?.qualifier) {
      const signatures = registry.typeMembers.get(api.name)?.has(api.qualifier)
        ? signaturesOf(spec, api.qualifier, api.name)
        : [];
      return signatures.length > 0 ? { name: `${api.qualifier}.${api.name}`, signatures } : null;
    }
    if (api && registry.all.has(api.name)) {
      const signatures = signaturesOf(spec, api.name);
      if (signatures.length > 0) {
        // `### subscribe` under `## Room`: the member, not the export of the same name.
        if (chain.slice(i + 1).some((h) => namesType(registry, h, api.name))) return null;
        return { name: api.name, signatures };
      }
    }
    if (!NEUTRAL_HEADING.test(heading.text.trim())) return null;
  }
  return null;
}

function isPlainSchema(schema: ApiSchema | undefined, typeParams: ReadonlySet<string>): boolean {
  if (typeof schema === 'string') return PLAIN_TYPES.has(schema) || typeParams.has(schema);
  if (!schema || typeof schema !== 'object') return false;
  const s = schema as Record<string, unknown>;
  if (s['x-ts-function'] === true || s.enum !== undefined || s.const !== undefined) return true;
  const union = Array.isArray(s.anyOf) ? s.anyOf : Array.isArray(s.oneOf) ? s.oneOf : null;
  if (union) return union.every((arm) => isPlainSchema(arm as ApiSchema, typeParams));
  if (typeof s.type === 'string' && PLAIN_TYPES.has(s.type)) return true;
  const xts = s['x-ts-type'];
  return typeof xts === 'string' && typeParams.has(xts.replace(/\[\]$/, ''));
}

type OwnerShape = {
  /** Positional names, every overload, first-seen order */
  names: string[];
  /** Properties of closed object parameters, by parameter name */
  keysByParam: Map<string, Set<string>>;
  /** Parameters that may carry keys the spec cannot list (type parameters excluded) */
  openParams: Set<string>;
  /** As `openParams`, plus parameters typed by a type parameter */
  genericParams: Set<string>;
  /** Every overload with parameters has exactly one, a closed object */
  singleClosed: boolean;
};

function ownerShape(spec: ApiSpec, owner: Owner): OwnerShape | null {
  const names: string[] = [];
  const keysByParam = new Map<string, Set<string>>();
  const openParams = new Set<string>();
  const genericParams = new Set<string>();
  let singleClosed = true;
  let anyParams = false;
  for (const sig of owner.signatures) {
    const params = sig.parameters ?? [];
    const typeParams = new Set((sig.typeParameters ?? []).map((t) => t.name));
    if (params.length > 0) anyParams = true;
    if (params.length > 1) singleClosed = false;
    for (const p of params) {
      // Destructured / synthetic names (`{ a, b }`, `__0`) cannot be compared.
      if (!IDENT_RE.test(p.name) || p.name.startsWith('__')) return null;
      if (!names.includes(p.name)) names.push(p.name);
      const closed = closedObjectShape(spec, p.schema);
      if (closed) {
        const keys = keysByParam.get(p.name) ?? new Set<string>();
        for (const k of closed.keys) keys.add(k);
        keysByParam.set(p.name, keys);
        continue;
      }
      if (params.length === 1) singleClosed = false;
      if (!isPlainSchema(p.schema, new Set())) genericParams.add(p.name);
      if (!isPlainSchema(p.schema, typeParams)) openParams.add(p.name);
    }
  }
  if (!anyParams) return null;
  return { names, keysByParam, openParams, genericParams, singleClosed };
}

/** Parameter names the page itself gives the owner: `create(stateCreatorFn)` in a heading or fence. */
function displayNames(content: string, name: string): Set<string> {
  const out = new Set<string>();
  const bare = name.split('.').pop() ?? name;
  const call = new RegExp(
    `(?<![\\w$])${bare.replace(/[$]/g, '\\$&')}\\s*(?:<[^()\\n]*>)?\\s*\\(`,
    'g',
  );
  for (const m of content.matchAll(call)) {
    let open = (m.index ?? 0) + m[0].length - 1;
    // `create<T>()(stateCreatorFn)`: every chained argument list.
    while (content[open] === '(') {
      const close = matchingParen(content, open);
      if (close === -1) break;
      for (const part of splitTopLevel(content.slice(open + 1, close))) {
        const id = part.match(
          new RegExp(`^(?:\\.\\.\\.)?(${IDENT})\\s*\\??\\s*(?:[:=][\\s\\S]*)?$`),
        );
        if (id) out.add(id[1]);
      }
      open = close + 1;
    }
  }
  return out;
}

function matchingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length && i < open + 2000; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

function isComponent(spec: ApiSpec, name: string): boolean {
  if (!/^[A-Z]/.test(name)) return false;
  const entry = spec.exports?.find((e) => e.name === name);
  return entry !== undefined && entry.kind !== 'class';
}

/** The one primitive every overload gives `param`, else null. */
function primitiveOf(owner: Owner, param: string): string | null {
  let found: string | null = null;
  for (const sig of owner.signatures) {
    for (const p of sig.parameters ?? []) {
      if (p.name !== param) continue;
      const s = p.schema;
      if (!s || typeof s !== 'object') return null;
      const rec = s as Record<string, unknown>;
      if (typeof rec.type !== 'string' || !PRIMITIVES.has(rec.type)) return null;
      if (rec.enum !== undefined || rec.const !== undefined || rec.anyOf || rec.oneOf) return null;
      if (found && found !== rec.type) return null;
      found = rec.type;
    }
  }
  return found;
}

function judgeBlock(
  block: Block,
  owner: Owner,
  shape: OwnerShape,
  spec: ApiSpec,
  registry: ExportRegistry,
  content: string,
  keysSection: boolean,
): ParamDocHit[] {
  if (block.rows.some((r) => r.rest || r.prose)) return [];

  const allKeys = new Set<string>();
  for (const keys of shape.keysByParam.values()) for (const k of keys) allKeys.add(k);
  const component = isComponent(spec, owner.name);
  let mode = block.mode;
  let noun = block.noun;
  if (mode === 'keys') {
    if (component) {
      // Props are the single closed props type, else the destructured names.
      if (!shape.singleClosed) {
        if (shape.names.length === 1 && shape.genericParams.size > 0) return [];
        mode = 'names';
      }
      noun = NOUNS.prop;
    } else if (shape.genericParams.size > 0) return [];
  }

  const display = displayNames(content, owner.name);
  const known = new Set([...shape.names, ...allKeys]);
  const hits: ParamDocHit[] = [];
  let anchored = 0;
  const hit = (row: Row, issue: string, suggestion: string): void => {
    hits.push({
      type: 'prose-param-mismatch',
      issue,
      suggestion,
      exportName: owner.name,
      text: row.key,
      span: row.span,
      line: row.line,
    });
  };
  const listed =
    mode === 'keys' && allKeys.size > 0 ? [...allKeys].sort().join(', ') : shape.names.join(', ');

  for (const row of block.rows) {
    const dotted = row.key.match(DOTTED_RE);
    if (dotted) {
      const [, prefix, prop] = dotted;
      let keys: Set<string> | undefined;
      if (shape.names.includes(prefix)) keys = shape.keysByParam.get(prefix);
      else if (LITERAL_PREFIX.has(prefix) && shape.genericParams.size === 0) keys = allKeys;
      if (!keys || keys.size === 0) continue;
      if (shape.openParams.has(prefix) || shape.genericParams.has(prefix)) continue;
      if (keys.has(prop)) anchored++;
      else {
        hit(
          row,
          `${cap(noun.one)} '${row.key}' is not ${article(noun.one)} of '${owner.name}'`,
          `Properties: ${[...keys].sort().join(', ')}`,
        );
      }
      continue;
    }

    if (known.has(row.key)) {
      anchored++;
      const documented = row.typeCell?.replace(/`/g, '').trim();
      const actual = shape.names.includes(row.key) ? primitiveOf(owner, row.key) : null;
      if (documented && actual && PRIMITIVES.has(documented) && documented !== actual) {
        hit(
          row,
          `${cap(noun.one)} '${row.key}' is documented as '${documented}', spec says '${actual}'`,
          `Type: ${actual}`,
        );
      }
      continue;
    }
    if (display.has(row.key)) continue;
    // First column holds export names: a table of hooks, not of parameters.
    if (registry.all.has(row.key)) return [];
    hit(
      row,
      `${cap(noun.one)} '${row.key}' is not ${article(noun.one)} of '${owner.name}'`,
      `${noun.many}: ${listed}`,
    );
  }

  const mismatches = hits.filter((h) => !h.issue.includes('is documented as'));
  if (mismatches.length > 0 && anchored === 0) {
    // Nothing on the table matches the spec, so nothing ties it to this
    // callable but its place on the page. Enough for an `Options` section, or
    // for the one row of a one-parameter callable; otherwise another table.
    const renamedOnly = block.rows.length === 1 && shape.names.length === 1;
    if (!(mode === 'keys' ? keysSection : renamedOnly)) return [];
  }
  return hits;
}

function cap(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function article(word: string): string {
  return `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;
}

/** A parameter / option table or list on the page: where it starts, its keys, and the export it documents. */
export type ParamDocBlock = {
  /** 1-indexed markdown line of the header row / first item */
  line: number;
  keys: string[];
  /** `name` or `Type.member` the enclosing headings name, when they do */
  owner?: string;
};

/** Every parameter table and `## Parameters` list, judged or not. */
export function paramDocBlocks(
  content: string,
  spec: ApiSpec,
  registry: ExportRegistry,
  headings: PageHeading[],
): ParamDocBlock[] {
  return collectBlocks(content, headings).map((block) => {
    const owner = findOwner(spec, registry, headings, block.line);
    return {
      line: block.line,
      keys: block.rows.map((r) => r.key),
      ...(owner ? { owner: owner.name } : {}),
    };
  });
}

/**
 * Parameter tables (`| Param | Type | Description |`) and `## Parameters`
 * bullet lists, checked against the signatures of the one export the section
 * heading names. A row whose key is not a parameter (or, for Prop/Option
 * tables and `options.x` rows, not a property of a closed parameter type) in
 * any overload is a claim; so is a primitive Type cell that contradicts a
 * primitive spec type. Exact or silent.
 */
export function findParamDocHits(
  content: string,
  spec: ApiSpec,
  registry: ExportRegistry,
  headings: PageHeading[],
): ParamDocHit[] {
  const hits: ParamDocHit[] = [];
  for (const block of collectBlocks(content, headings)) {
    const owner = findOwner(spec, registry, headings, block.line);
    if (!owner) continue;
    const shape = ownerShape(spec, owner);
    if (!shape) continue;
    const nearest = nearestHeading(headings, block.line);
    const keysSection = nearest !== undefined && KEYS_HEADING.test(nearest.text.trim());
    hits.push(...judgeBlock(block, owner, shape, spec, registry, content, keysSection));
  }
  return hits;
}
