import type { ApiSchema, ApiSignature, ApiSignatureParameter, ApiSpec } from '../analysis/api-spec';
import { isExternalExport } from '../analysis/documented';
import type { ExportRegistry } from '../analysis/drift/types';
import { findTypeEntry } from '../analysis/key-coverage';
import type { CallSite, LiteralValue } from './fences';
import { extractCallSites, extractLocalNames } from './fences';
import { elementSchema, signaturesOf } from './spec-ref';

export type CallSiteRuleType =
  | 'prose-unknown-key'
  | 'prose-arity-mismatch'
  | 'prose-missing-required'
  | 'prose-literal-type-mismatch';

export type CallSiteHit = {
  type: CallSiteRuleType;
  issue: string;
  suggestion?: string;
  exportName: string;
  member?: string;
  text: string;
  /** 0-indexed line / column of `text` within the fence code */
  line: number;
  col: number;
};

type ParamShape = {
  name: string;
  required: boolean;
  rest: boolean;
  schema: ApiSchema | undefined;
};

type OverloadShape = {
  params: ParamShape[];
  maxPositional: number;
};

export type ClosedShape = {
  keys: Set<string>;
  required: Set<string>;
  /**
   * Arms of a destructured union (`{ prompt } | { messages }`): the keys each
   * arm requires beyond `required`. A literal must supply every key of one arm.
   */
  alternatives?: string[][];
};

const JSX_RESERVED = new Set(['key', 'ref']);
const OPEN_XTS = new Set(['any', 'unknown', 'object']);
const UTILITY_XTS = new Set([
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Record',
  'Exclude',
  'Extract',
  'NonNullable',
  'Awaited',
]);
const INDEXED_OPEN = new Set([
  'Parameters',
  'ReturnType',
  'InstanceType',
  'ConstructorParameters',
  'ThisParameterType',
  'OmitThisParameter',
]);

type SpecEntry = NonNullable<ReturnType<typeof findTypeEntry>>;
type ShapeHit = ClosedShape | 'open' | null;

function hasIndexSignature(s: Record<string, unknown>): boolean {
  return s.additionalProperties !== undefined && s.additionalProperties !== false;
}

/**
 * `anyOf` arms that carry nothing but `required`: how a destructured union
 * parameter (`{ model, prompt | messages }`) is emitted beside the merged
 * `properties`. Null when any arm says anything else.
 */
function requiredArms(s: Record<string, unknown>): string[][] | null {
  if (!Array.isArray(s.anyOf) || s.anyOf.length === 0) return null;
  const arms: string[][] = [];
  for (const arm of s.anyOf) {
    if (typeof arm !== 'object' || arm === null) return null;
    const a = arm as Record<string, unknown>;
    if (!Array.isArray(a.required) || Object.keys(a).some((k) => k !== 'required')) return null;
    arms.push(a.required.filter((k): k is string => typeof k === 'string'));
  }
  return arms;
}

function propertiesShape(s: Record<string, unknown>): ClosedShape | null {
  if (hasIndexSignature(s)) return null;
  const props = s.properties;
  if (typeof props !== 'object' || props === null) return null;
  const keys = new Set(Object.keys(props as Record<string, unknown>));
  if (keys.size === 0) return null;
  const required = new Set<string>();
  if (Array.isArray(s.required)) {
    for (const k of s.required) if (typeof k === 'string' && keys.has(k)) required.add(k);
  }
  const arms = requiredArms(s)?.map((arm) => arm.filter((k) => keys.has(k) && !required.has(k)));
  // An arm with nothing left to ask for is satisfied by any literal.
  if (arms?.every((arm) => arm.length > 0)) return { keys, required, alternatives: arms };
  return { keys, required };
}

function mergeClosed(shapes: ClosedShape[], mode: 'union' | 'all'): ClosedShape {
  const keys = new Set<string>();
  const required = new Set<string>();
  if (mode === 'union') {
    for (const s of shapes) for (const k of s.keys) keys.add(k);
    if (shapes[0]) {
      for (const k of shapes[0].required) {
        if (shapes.every((s) => s.required.has(k))) required.add(k);
      }
    }
    return { keys, required };
  }
  for (const s of shapes) {
    for (const k of s.keys) keys.add(k);
    for (const k of s.required) required.add(k);
  }
  // One set of alternatives per shape: a second union in an intersection is not modeled.
  const alternatives = shapes.find((s) => s.alternatives)?.alternatives;
  return alternatives ? { keys, required, alternatives } : { keys, required };
}

/**
 * Closed object shape: named interface / type alias / inline object type with
 * known properties and no index signature. Null for type parameters, utilities
 * over them, object/any/unknown, Record, open unions, unresolved/external
 * refs, or a generic mapped/conditional alias. Intersection keys are the union
 * of every arm; interface keys include `extends`. Any open arm opens the shape.
 * Top-level properties only — never members of nested property types.
 */
export function closedObjectShape(
  spec: ApiSpec,
  schema: ApiSchema | undefined,
  seen: Set<string> = new Set(),
): ClosedShape | null {
  const hit = schemaShape(spec, schema, seen);
  return hit === 'open' || hit === null ? null : hit;
}

function splitHeritage(raw: string): string[] {
  return raw
    .split(/[,&]/)
    .map((p) => p.replace(/<[\s\S]*$/, '').trim())
    .filter(Boolean);
}

function isMappedOrConditional(schema: ApiSchema | undefined): boolean {
  if (!schema || typeof schema !== 'object') return false;
  const s = schema as Record<string, unknown>;
  return s['x-ts-mapped'] === true || s['x-ts-conditional'] === true;
}

function membersShape(entry: {
  members?: Array<{ name?: string; kind?: string }>;
}): ClosedShape | null {
  const keys = new Set<string>();
  for (const m of entry.members ?? []) {
    if (!m.name) continue;
    if (m.kind === 'method' || m.kind === 'function') continue;
    keys.add(m.name);
  }
  if (keys.size === 0) return null;
  return { keys, required: new Set() };
}

function schemaShape(spec: ApiSpec, schema: ApiSchema | undefined, seen: Set<string>): ShapeHit {
  if (schema === undefined || schema === null) return null;
  if (typeof schema === 'string') {
    if (schema === 'object' || schema === 'any' || schema === 'unknown') return 'open';
    if (seen.has(schema)) return 'open';
    seen.add(schema);
    const entry = findTypeEntry(spec, schema);
    if (!entry) return 'open';
    return entryShape(spec, entry, seen);
  }
  if (typeof schema !== 'object') return null;
  const s = schema as Record<string, unknown>;
  if (hasIndexSignature(s)) return 'open';

  const union = (Array.isArray(s.anyOf) ? s.anyOf : Array.isArray(s.oneOf) ? s.oneOf : null) as
    | ApiSchema[]
    | null;
  // Pure `required` arms beside `properties` name alternatives, not shapes: the
  // merged properties below carry every key.
  const alternatives = s.properties !== undefined && requiredArms(s) !== null;
  if (union && union.length > 0 && !alternatives) {
    const shapes: ClosedShape[] = [];
    for (const arm of union) {
      const sh = schemaShape(spec, arm, seen);
      if (sh === 'open' || sh === null) return 'open';
      shapes.push(sh);
    }
    return mergeClosed(shapes, 'union');
  }

  if (Array.isArray(s.allOf) && s.allOf.length > 0) {
    const shapes: ClosedShape[] = [];
    for (const arm of s.allOf) {
      const sh = schemaShape(spec, arm as ApiSchema, seen);
      if (sh === 'open') return 'open';
      if (sh) shapes.push(sh);
    }
    const self = propertiesShape(s);
    if (self) shapes.push(self);
    if (shapes.length === 0) return 'open';
    return mergeClosed(shapes, 'all');
  }

  if (typeof s.$ref === 'string') {
    const name = s.$ref.split('/').pop() ?? '';
    if (!name || seen.has(name)) return 'open';
    seen.add(name);
    const entry = findTypeEntry(spec, name);
    if (!entry) return 'open';
    return entryShape(spec, entry, seen);
  }

  const xts = s['x-ts-type'];
  if (typeof xts === 'string') {
    if (OPEN_XTS.has(xts) || INDEXED_OPEN.has(xts)) return 'open';
    if (UTILITY_XTS.has(xts)) return propertiesShape(s) ?? 'open';
    if (!s.properties) {
      // An external entry's schema names itself (`ReactNode` → `ReactNode`).
      if (seen.has(xts)) return 'open';
      seen.add(xts);
      const entry = findTypeEntry(spec, xts);
      if (!entry) return 'open';
      return entryShape(spec, entry, seen);
    }
  }

  if (s.type === 'object' || s.properties) return propertiesShape(s);
  return null;
}

function entryShape(spec: ApiSpec, entry: SpecEntry, seen: Set<string>): ShapeHit {
  if (isExternalExport(entry) || entry.kind === 'external') return 'open';
  const typeParams = entry.typeParameters;
  if (
    (entry.kind === 'type' || entry.kind === 'alias') &&
    ((typeParams && typeParams.length > 0) || isMappedOrConditional(entry.schema))
  ) {
    return 'open';
  }

  const shapes: ClosedShape[] = [];
  const heritage = entry.extends;
  if (typeof heritage === 'string' && heritage.trim()) {
    for (const name of splitHeritage(heritage)) {
      const base = findTypeEntry(spec, name);
      if (!base) return 'open';
      const sh = entryShape(spec, base, seen);
      if (sh === 'open') return 'open';
      if (sh) shapes.push(sh);
    }
  }

  const fromSchema = schemaShape(spec, entry.schema, seen);
  if (fromSchema === 'open') return 'open';
  if (fromSchema) shapes.push(fromSchema);

  const fromMembers = membersShape(entry);
  if (fromMembers) shapes.push(fromMembers);

  if (shapes.length === 0) return null;
  return mergeClosed(shapes, 'all');
}

const REST_NAMES = new Set(['args', 'rest']);

/**
 * `rest: true`, a name emitted as `...args`, or a trailing `args` / `rest`
 * that is not typed as a named or inline object: what an extractor that drops
 * the rest marker leaves of `(...args) =>`. Whatever `required` says.
 */
function isRestParam(p: ApiSignatureParameter, last: boolean): boolean {
  if (p.rest === true || p.name.startsWith('...')) return true;
  if (!last || !REST_NAMES.has(p.name)) return false;
  if (p.schema === undefined || p.schema === null) return true;
  if (typeof p.schema !== 'object') return p.schema === 'unknown' || p.schema === 'any';
  const s = p.schema as Record<string, unknown>;
  return typeof s.$ref !== 'string' && s.properties === undefined;
}

function paramShape(p: ApiSignatureParameter, last: boolean): ParamShape {
  const rest = isRestParam(p, last);
  return {
    name: p.name.replace(/^\.\.\./, ''),
    required: p.required !== false && p.default === undefined && !rest,
    rest,
    schema: p.schema,
  };
}

function overloadShape(sig: ApiSignature): OverloadShape {
  const list = sig.parameters ?? [];
  const params = list.map((p, i) => paramShape(p, i === list.length - 1));
  const rest = params.some((p) => p.rest);
  return { params, maxPositional: rest ? Number.POSITIVE_INFINITY : params.length };
}

function paramAt(ov: OverloadShape, index: number): ParamShape | undefined {
  if (index < ov.params.length) {
    const p = ov.params[index];
    if (p && !p.rest) return p;
  }
  return ov.params.find((p) => p.rest);
}

/** A parameter an object literal can never be passed for: a primitive or a function. */
function takesNoObject(schema: ApiSchema | undefined): boolean {
  if (!schema || typeof schema !== 'object') return false;
  const s = schema as Record<string, unknown>;
  if (s['x-ts-function'] === true) return true;
  const primitive = (t: unknown): boolean =>
    t === 'string' || t === 'number' || t === 'integer' || t === 'boolean' || t === 'null';
  return Array.isArray(s.type) ? s.type.every(primitive) : primitive(s.type);
}

function closedAt(spec: ApiSpec, ov: OverloadShape, index: number): ClosedShape | null {
  const p = paramAt(ov, index);
  if (!p) return null;
  return closedObjectShape(spec, p.schema, new Set());
}

function jsxPropsForOverload(spec: ApiSpec, ov: OverloadShape): ClosedShape | null {
  const p0 = ov.params[0];
  if (!p0) return { keys: new Set(), required: new Set() };
  if (ov.params.length === 1) {
    const closed = closedObjectShape(spec, p0.schema, new Set());
    if (closed) return closed;
  }
  const keys = new Set<string>();
  const required = new Set<string>();
  for (const p of ov.params) {
    if (p.rest) continue;
    keys.add(p.name);
    if (p.required) required.add(p.name);
  }
  if (keys.size === 0) return null;
  return { keys, required };
}

function jsxPropShape(spec: ApiSpec, overloads: OverloadShape[]): ClosedShape | null {
  let shape: ClosedShape | null = null;
  for (const ov of overloads) {
    const next = jsxPropsForOverload(spec, ov);
    if (!next) continue;
    if (!shape) {
      shape = { ...next, keys: new Set(next.keys), required: new Set(next.required) };
      continue;
    }
    const keys = new Set<string>();
    for (const k of shape.keys) if (next.keys.has(k)) keys.add(k);
    const required = new Set<string>();
    for (const k of shape.required) if (next.required.has(k)) required.add(k);
    // Alternatives are per overload; across overloads only the intersection is claimed.
    shape = { keys, required };
  }
  return shape;
}

export type CallSiteContext = {
  namespaces?: ReadonlySet<string>;
  namedImports?: ReadonlySet<string>;
  /** Renamed imports: local → export (`import { a as b }` → b → a; `import x` → x → default). */
  aliases?: ReadonlyMap<string, string>;
  /** Names the fence declares itself: a bare callee among them is not the export. */
  locals?: ReadonlySet<string>;
  /** Names an earlier fence of the page declared: shadow the export like `locals`. */
  shadowed?: ReadonlySet<string>;
  /** Exports another entry of the package types differently, in a fence that names no entry. */
  ambiguous?: ReadonlySet<string>;
  skip?: boolean;
};

function bareCalleeAllowed(name: string, ctx?: CallSiteContext): boolean {
  if (!ctx) return true;
  if (ctx.namedImports?.has(name)) return true;
  if (
    ctx.namespaces &&
    ctx.namespaces.size > 0 &&
    (!ctx.namedImports || ctx.namedImports.size === 0)
  ) {
    return false;
  }
  if (ctx.namedImports && ctx.namedImports.size > 0) return false;
  return true;
}

function resolveCallee(
  site: CallSite,
  registry: ExportRegistry,
  bindings: Map<string, string>,
  ctx?: CallSiteContext,
): { exportName: string; member?: string } | null {
  if (ctx?.skip) return null;
  if (site.objectName) {
    if (ctx?.namespaces?.has(site.objectName)) {
      if (registry.all.has(site.name) && !ctx.ambiguous?.has(site.name)) {
        return { exportName: site.name };
      }
      return null;
    }
    const bound = bindings.get(site.objectName);
    if (!bound) return null;
    const resolved = registry.callableReturnTypes.get(bound) ?? bound;
    if (!registry.all.has(resolved) && !registry.typeNames.includes(resolved)) return null;
    return { exportName: resolved, member: site.name };
  }
  if (ctx?.locals?.has(site.name)) return null;
  if (!bareCalleeAllowed(site.name, ctx)) return null;
  const exportName = ctx?.aliases?.get(site.name) ?? site.name;
  if (registry.all.has(exportName) && !ctx?.ambiguous?.has(exportName)) return { exportName };
  return null;
}

function displayName(callee: { exportName: string; member?: string }, site: CallSite): string {
  if (site.kind === 'jsx')
    return `<${site.objectName ? `${site.objectName}.${site.name}` : site.name}>`;
  if (callee.member) return `${callee.exportName}.${callee.member}`;
  // The default export has no name of its own: the page's local name reads better.
  return callee.exportName === 'default' ? site.name : callee.exportName;
}

function unknownLiteralKeys(
  spec: ApiSpec,
  overloads: OverloadShape[],
  site: CallSite,
): { unknown: string[]; allowed: string[] } | null {
  const unknown: string[] = [];
  const allowed = new Set<string>();
  let anyClosed = false;
  site.args.forEach((arg, i) => {
    if (!arg.keys || arg.keys.length === 0) return;
    const shapes: ClosedShape[] = [];
    for (const ov of overloads) {
      const p = paramAt(ov, i);
      if (!p) continue;
      const sh = closedObjectShape(spec, p.schema, new Set());
      if (sh) shapes.push(sh);
      // An overload that takes an object here whose keys cannot be seen may be the one the
      // docs mean: `toJSONSchema(registry, { uri })` fits the second overload, not the first.
      else if (!takesNoObject(p.schema)) return;
    }
    if (shapes.length === 0) return;
    anyClosed = true;
    const keys = new Set<string>();
    for (const sh of shapes) for (const k of sh.keys) keys.add(k);
    for (const k of keys) allowed.add(k);
    for (const k of arg.keys) if (!keys.has(k)) unknown.push(k);
  });
  if (!anyClosed) return null;
  return { unknown, allowed: [...allowed].sort() };
}

function missingRequired(spec: ApiSpec, overloads: OverloadShape[], site: CallSite): string[] {
  if (site.hasSpreadArg || site.hasJsxSpread) return [];
  // `z.map();` on a line of its own names the API, like a backticked `useSelf()`.
  if (site.bareStatement && site.argCount === 0) return [];

  if (site.kind === 'jsx') {
    const shape = jsxPropShape(spec, overloads);
    if (!shape || shape.required.size === 0) return [];
    const supplied = new Set(site.jsxKeys);
    if (site.hasChildren) supplied.add('children');
    return [...shape.required].filter((k) => !supplied.has(k));
  }

  let required: Set<string> | null = null;
  for (const ov of overloads) {
    const names = new Set<string>();
    ov.params.forEach((p, i) => {
      if (p.rest) return;
      if (p.required) names.add(`param:${i}:${p.name}`);
      const arg = site.args[i];
      // An elided literal (`{ // ... }`, `{ ...rest }`) may hold its keys in the part not shown.
      if (arg?.keys && !arg.elided) {
        const sh = closedAt(spec, ov, i);
        if (sh) for (const k of sh.required) names.add(`key:${k}`);
      }
    });
    if (required === null) required = names;
    else {
      const next = new Set<string>();
      for (const n of required) if (names.has(n)) next.add(n);
      required = next;
    }
  }
  if (!required || required.size === 0) return [];

  const suppliedKeys = new Set<string>();
  let nonLiteral = false;
  for (const arg of site.args) {
    if (arg.keys) for (const k of arg.keys) suppliedKeys.add(k);
    else if (!arg.hasSpread) nonLiteral = true;
  }

  const missing: string[] = [];
  for (const slot of required) {
    if (slot.startsWith('param:')) {
      const parts = slot.split(':');
      const i = Number(parts[1]);
      if (site.argCount <= i) missing.push(parts[2]);
    } else if (slot.startsWith('key:')) {
      const key = slot.slice(4);
      if (!suppliedKeys.has(key)) {
        if (nonLiteral && site.argCount > 0) continue;
        missing.push(key);
      }
    }
  }
  return missing;
}

function satisfiesOne(arms: string[][], supplied: ReadonlySet<string>): boolean {
  return arms.some((arm) => arm.every((k) => supplied.has(k)));
}

/**
 * The arms of a destructured union that a closed literal satisfies none of:
 * `generateText({ model })` with `{ prompt } | { messages }`. Null when the
 * literal is elided, an overload has no alternatives at that slot, or one is met.
 */
function unsatisfiedAlternatives(
  spec: ApiSpec,
  overloads: OverloadShape[],
  site: CallSite,
): string[][] | null {
  if (site.kind === 'jsx') {
    if (site.hasJsxSpread) return null;
    const arms = jsxPropShape(spec, overloads)?.alternatives;
    if (!arms) return null;
    const supplied = new Set(site.jsxKeys);
    if (site.hasChildren) supplied.add('children');
    return satisfiesOne(arms, supplied) ? null : arms;
  }

  if (site.hasSpreadArg) return null;
  for (const [i, arg] of site.args.entries()) {
    if (!arg.keys || arg.elided) continue;
    const supplied = new Set(arg.keys);
    const taking = overloads.filter((ov) => i < ov.maxPositional);
    let first: string[][] | null = null;
    let unmet = taking.length > 0;
    for (const ov of taking) {
      const arms = closedAt(spec, ov, i)?.alternatives;
      if (!arms || satisfiesOne(arms, supplied)) {
        unmet = false;
        break;
      }
      first ??= arms;
    }
    if (unmet && first) return first;
  }
  return null;
}

function armLabel(arms: string[][]): string {
  return arms.map((arm) => arm.map((k) => `'${k}'`).join(' + ')).join(', ');
}

const PRIMITIVES = new Set(['string', 'number', 'boolean']);
const ANNOTATIONS = new Set(['type', 'description']);

/**
 * `string` / `number` / `boolean` when the schema is exactly that primitive,
 * after dropping `| undefined` / `| null`. A union of anything else, a literal
 * union (`enum` / `const`), a format, a brand (`allOf`), a generic, `any` /
 * `unknown` or a `$ref`: undefined.
 */
function exactPrimitive(schema: ApiSchema | undefined): string | undefined {
  if (typeof schema === 'string') return PRIMITIVES.has(schema) ? schema : undefined;
  if (!schema || typeof schema !== 'object') return undefined;
  const s = schema as Record<string, unknown>;
  const arms = Array.isArray(s.anyOf) ? s.anyOf : Array.isArray(s.oneOf) ? s.oneOf : null;
  if (arms) {
    const rest = (arms as Array<Record<string, unknown>>).filter(
      (a) => a?.type !== 'null' && a?.type !== 'undefined' && a?.['x-ts-type'] !== 'undefined',
    );
    return rest.length === 1 ? exactPrimitive(rest[0] as ApiSchema) : undefined;
  }
  if (typeof s.type !== 'string' || !PRIMITIVES.has(s.type)) return undefined;
  return Object.keys(s).every((k) => ANNOTATIONS.has(k)) ? s.type : undefined;
}

type Declared = { name: string; primitive: string };

/**
 * The primitive every candidate declares, when the literal fits none of them.
 * A candidate that is not exactly a primitive, or is the literal's own type,
 * may accept the literal: null.
 */
function mismatched(
  literal: LiteralValue,
  candidates: Array<{ name: string; schema: ApiSchema | undefined } | null>,
): Declared | null {
  let first: Declared | null = null;
  for (const candidate of candidates) {
    const primitive = candidate ? exactPrimitive(candidate.schema) : undefined;
    if (!candidate || !primitive || primitive === literal.type) return null;
    first ??= { name: candidate.name, primitive };
  }
  return first;
}

/** A literal argument, object-literal property or JSX attribute of the wrong primitive type. */
function literalMismatches(
  spec: ApiSpec,
  overloads: OverloadShape[],
  site: CallSite,
): Array<{ literal: LiteralValue; subject: string; declared: Declared }> {
  const found: Array<{ literal: LiteralValue; subject: string; declared: Declared }> = [];
  const property = (ov: OverloadShape, p: ParamShape | undefined, key: string) => {
    if (!p || p.rest || !closedObjectShape(spec, p.schema, new Set())?.keys.has(key)) return null;
    return { name: key, schema: elementSchema(spec, p.schema, key, new Set()) };
  };

  if (site.kind === 'jsx') {
    if (site.hasJsxSpread) return found;
    for (const { key, literal } of site.jsxLiterals ?? []) {
      if (JSX_RESERVED.has(key)) continue;
      const declared = mismatched(
        literal,
        overloads.map((ov) => {
          if (ov.params.length === 1) return property(ov, ov.params[0], key);
          const named = ov.params.find((p) => p.name === key && !p.rest);
          return named ? { name: key, schema: named.schema } : null;
        }),
      );
      if (declared) found.push({ literal, subject: `Prop '${key}'`, declared });
    }
    return found;
  }

  if (site.hasSpreadArg) return found;
  site.args.forEach((arg, i) => {
    // An overload with fewer parameters cannot be the one this call means.
    const taking = overloads.filter((ov) => i < ov.maxPositional);
    if (taking.length === 0) return;
    if (arg.literal) {
      const declared = mismatched(
        arg.literal,
        taking.map((ov) => {
          const p = paramAt(ov, i);
          return p && !p.rest ? { name: p.name, schema: p.schema } : null;
        }),
      );
      if (declared) found.push({ literal: arg.literal, subject: `Argument ${i + 1}`, declared });
    }
    if (arg.hasSpread) return;
    for (const { key, literal } of arg.props ?? []) {
      const declared = mismatched(
        literal,
        taking.map((ov) => property(ov, paramAt(ov, i), key)),
      );
      if (declared) {
        found.push({ literal, subject: `Property '${key}' of argument ${i + 1}`, declared });
      }
    }
  });
  return found;
}

function judgeSite(
  site: CallSite,
  spec: ApiSpec,
  registry: ExportRegistry,
  bindings: Map<string, string>,
  ctx?: CallSiteContext,
): CallSiteHit[] {
  if (site.elided) return [];
  const callee = resolveCallee(site, registry, bindings, ctx);
  if (!callee) return [];
  const sigs = signaturesOf(spec, callee.exportName, callee.member);
  if (sigs.length === 0) return [];
  const overloads = sigs.map((s) => overloadShape(s));
  const hits: CallSiteHit[] = [];
  const label = displayName(callee, site);
  const base = {
    exportName: callee.exportName,
    member: callee.member,
    text: site.text,
    line: site.line,
    col: site.col,
  };

  if (site.kind !== 'jsx' && !site.hasSpreadArg) {
    const maxArgs = Math.max(...overloads.map((o) => o.maxPositional));
    if (Number.isFinite(maxArgs) && site.argCount > maxArgs) {
      hits.push({
        ...base,
        type: 'prose-arity-mismatch',
        issue: `Call '${label}' has ${site.argCount} arguments; spec allows at most ${maxArgs}`,
      });
    }
  }

  if (site.kind === 'jsx') {
    const shape = jsxPropShape(spec, overloads);
    const allowed = new Set(shape?.keys ?? []);
    for (const k of JSX_RESERVED) allowed.add(k);
    const known = [...allowed].filter((k) => !JSX_RESERVED.has(k));
    const unknown = site.jsxKeys.filter((k) => !JSX_RESERVED.has(k) && !allowed.has(k));
    if (unknown.length > 0 && known.length > 0) {
      hits.push({
        ...base,
        type: 'prose-unknown-key',
        issue: `Unknown prop '${unknown.join("', '")}' on '${label}'`,
        suggestion: `Allowed: ${known.sort().join(', ') || '(none)'}`,
      });
    }
  } else {
    const found = unknownLiteralKeys(spec, overloads, site);
    if (found && found.unknown.length > 0 && found.allowed.length > 0) {
      hits.push({
        ...base,
        type: 'prose-unknown-key',
        issue: `Unknown key '${found.unknown.join("', '")}' on '${label}'`,
        suggestion: `Allowed: ${found.allowed.join(', ') || '(none)'}`,
      });
    }
  }

  for (const { literal, subject, declared } of literalMismatches(spec, overloads, site)) {
    hits.push({
      ...base,
      text: literal.text,
      line: literal.line,
      col: literal.col,
      type: 'prose-literal-type-mismatch',
      issue: `${subject} of '${label}' is a ${literal.type} literal; the spec declares '${declared.name}: ${declared.primitive}'`,
    });
  }

  // One claim per site: what is missing outright and which alternative is unmet share it.
  const missing = missingRequired(spec, overloads, site);
  const arms = unsatisfiedAlternatives(spec, overloads, site);
  if (missing.length > 0 || arms) {
    const kind = site.kind === 'jsx' ? 'prop' : 'argument';
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`is missing required ${kind} '${missing.join("', '")}'`);
    if (arms) parts.push(`needs one of ${armLabel(arms)}`);
    hits.push({
      ...base,
      type: 'prose-missing-required',
      issue: `${site.kind === 'jsx' ? 'JSX' : 'Call'} '${label}' ${parts.join(' and ')}`,
    });
  }

  return hits;
}

/**
 * Fence call-site rules. Only when the callee resolves to an export
 * (same polarity as `prose-unresolved-member`). Scan does not call this.
 */
export function detectCallSiteHits(
  code: string,
  spec: ApiSpec,
  registry: ExportRegistry,
  bindings: Map<string, string>,
  ctx?: CallSiteContext,
): CallSiteHit[] {
  if (ctx?.skip) return [];
  const hits: CallSiteHit[] = [];
  const scoped = {
    ...ctx,
    locals: new Set([...extractLocalNames(code), ...(ctx?.shadowed ?? [])]),
  };
  for (const site of extractCallSites(code)) {
    hits.push(...judgeSite(site, spec, registry, bindings, scoped));
  }
  return hits;
}
