import type { ApiExport, ApiMember, ApiSchema, ApiSignature, ApiSpec } from '../analysis/api-spec';
import type { ExportRegistry } from '../analysis/drift/types';
import { collectTypeKeys, findTypeEntry, parseReplacement } from '../analysis/key-coverage';
import type { KeyMeta } from '../analysis/key-coverage/types';
import type { SpecRef, SpecSlice } from './types';

const IDENT: RegExp = /^[A-Za-z_$][\w$]*$/;
const QUALIFIED: RegExp = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/;

export function parseDeprecationReplacement(note: string | undefined): string | undefined {
  if (!note) return undefined;
  const dotted = note.match(
    /use\s+`?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)`?(?:\([^)]*\))?\s+instead/i,
  );
  if (dotted) {
    const last = dotted[1].split('.').pop();
    if (last) return last;
  }
  return parseReplacement(note);
}

function schemaTypeName(schema: ApiSchema | undefined): string {
  if (schema === undefined || schema === null) return 'unknown';
  if (typeof schema === 'string') return schema;
  if (typeof schema !== 'object') return 'unknown';
  const s = schema as Record<string, unknown>;
  if (typeof s.$ref === 'string') return s.$ref.split('/').pop() ?? 'unknown';
  if (typeof s.type === 'string') return s.type;
  return 'unknown';
}

function formatCallSig(name: string, signature: ApiSignature | undefined): string {
  if (!signature) return name;
  const params = (signature.parameters ?? [])
    .map((p) => {
      const optional = p.required === false ? '?' : '';
      const rest = p.rest ? '...' : '';
      return `${rest}${p.name}${optional}: ${schemaTypeName(p.schema)}`;
    })
    .join(', ');
  const ret = signature.returns ? `: ${schemaTypeName(signature.returns.schema)}` : '';
  return `${name}(${params})${ret}`;
}

function findExport(spec: ApiSpec, name: string): ApiExport | undefined {
  return spec.exports?.find((e) => e.name === name || e.id === name);
}

function extraSignatures(entry: {
  signatures?: ApiSignature[];
  schema?: ApiSchema;
}): ApiSignature[] {
  if (entry.signatures?.length) return entry.signatures;
  if (!entry.schema || typeof entry.schema !== 'object') return [];
  const extra = (entry.schema as Record<string, unknown>)['x-ts-signatures'];
  return Array.isArray(extra) ? (extra as ApiSignature[]) : [];
}

/** Named `$ref` target of a return schema. Unwraps `Promise<T>`. */
export function namedReturnType(schema: ApiSchema | undefined): string | undefined {
  if (!schema || typeof schema !== 'object') return undefined;
  const s = schema as Record<string, unknown>;
  const awaited = unwrapPromise(schema);
  if (awaited !== schema) return namedReturnType(awaited);
  return typeof s.$ref === 'string' ? s.$ref.split('/').pop() : undefined;
}

function unwrapPromise(schema: ApiSchema | undefined): ApiSchema | undefined {
  if (!schema || typeof schema !== 'object') return schema;
  const s = schema as Record<string, unknown>;
  // OpenPkg emits `Promise<T>` as `x-ts-type: 'Promise'`; hand-written specs as a `$ref`.
  const isPromise =
    typeof s.$ref === 'string'
      ? s.$ref.split('/').pop() === 'Promise'
      : s['x-ts-type'] === 'Promise';
  if (!isPromise) return schema;
  const args = s['x-ts-type-arguments'] ?? s.typeArguments;
  return Array.isArray(args) && args.length > 0 ? unwrapPromise(args[0] as ApiSchema) : undefined;
}

/** `T`, or `T | null | undefined`: the one spec type a value of this schema can be. */
function soleRefName(schema: ApiSchema | undefined): string | undefined {
  if (!schema || typeof schema !== 'object') return undefined;
  const s = schema as Record<string, unknown>;
  if (typeof s.$ref === 'string') return s.$ref.split('/').pop();
  const arms = Array.isArray(s.anyOf) ? s.anyOf : Array.isArray(s.oneOf) ? s.oneOf : null;
  if (!arms) return undefined;
  const rest = (arms as Array<Record<string, unknown>>).filter(
    (a) => a?.type !== 'null' && a?.type !== 'undefined' && a?.['x-ts-type'] !== 'undefined',
  );
  return rest.length === 1 ? soleRefName(rest[0] as ApiSchema) : undefined;
}

function heritageNames(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(/[,&]/)
    .map((p) => p.replace(/<[\s\S]*$/, '').trim())
    .filter(Boolean);
}

/** Schema of property `key` (string) or tuple position `key` (number) of `schema`. */
function elementSchema(
  spec: ApiSpec,
  schema: ApiSchema | undefined,
  key: string | number,
  seen: Set<string>,
): ApiSchema | undefined {
  if (!schema || typeof schema !== 'object') return undefined;
  const s = schema as Record<string, unknown>;
  if (typeof s.$ref === 'string') {
    const name = s.$ref.split('/').pop() ?? '';
    if (!name || seen.has(name)) return undefined;
    seen.add(name);
    const entry = findTypeEntry(spec, name);
    if (!entry) return undefined;
    if (typeof key === 'string') {
      const member = entry.members?.find((m) => m.name === key);
      if (member) return member.kind === 'method' ? undefined : member.schema;
    }
    const own = elementSchema(spec, entry.schema, key, seen);
    if (own) return own;
    for (const base of heritageNames(entry.extends)) {
      const inherited = elementSchema(spec, { $ref: `#/types/${base}` }, key, seen);
      if (inherited) return inherited;
    }
    return undefined;
  }
  if (typeof key === 'number') {
    return Array.isArray(s.prefixItems) ? (s.prefixItems[key] as ApiSchema | undefined) : undefined;
  }
  const props = s.properties;
  if (typeof props !== 'object' || props === null) return undefined;
  return (props as Record<string, ApiSchema>)[key];
}

/**
 * Spec type a destructured element takes: property `key` (tuple position when
 * a number) of what `exportName(...)` / `Type.member(...)` returns, or of the
 * instance for `new`. Only a class / interface with a closed member list, and
 * only when every overload agrees. Promise is unwrapped.
 */
export function destructuredTypeName(
  spec: ApiSpec,
  registry: ExportRegistry,
  key: string | number,
  callee: { exportName: string; member?: string; isNew?: boolean },
): string | undefined {
  const returns: Array<ApiSchema | undefined> = callee.isNew
    ? [{ $ref: `#/types/${callee.exportName}` }]
    : signaturesOf(spec, callee.exportName, callee.member).map((sig) => sig.returns?.schema);
  if (returns.length === 0) return undefined;
  let name: string | undefined;
  for (const schema of returns) {
    const found = soleRefName(elementSchema(spec, unwrapPromise(schema), key, new Set()));
    if (!found || (name && found !== name)) return undefined;
    name = found;
  }
  return name && registry.closedReceivers.has(name) ? name : undefined;
}

/** Spec type returned by `Type.member(...)`, if the spec names one. */
export function memberReturnType(
  spec: ApiSpec,
  typeName: string,
  member: string,
): string | undefined {
  return namedReturnType(signaturesOf(spec, typeName, member)[0]?.returns?.schema);
}

/** Overload list for an export or `Type.member`. Empty when the spec has none. */
export function signaturesOf(spec: ApiSpec, exportName: string, member?: string): ApiSignature[] {
  if (member) {
    const mem = findMember(spec, exportName, member);
    return mem?.signatures ?? [];
  }
  const exp = findExport(spec, exportName);
  if (exp) return extraSignatures(exp);
  return [];
}

function findMember(spec: ApiSpec, parent: string, member: string): ApiMember | undefined {
  const entries = [...(spec.exports ?? []), ...(spec.types ?? [])].filter((e) => e.name === parent);
  for (const entry of entries) {
    const found = entry.members?.find((m) => m.name === member);
    if (found) return found;
  }
  return undefined;
}

export function typeKeyMeta(spec: ApiSpec, typeName: string): Map<string, KeyMeta> {
  const keys = new Map<string, KeyMeta>();
  const entries = [...(spec.exports ?? []), ...(spec.types ?? [])].filter(
    (e) => e.name === typeName,
  );
  for (const entry of entries) {
    for (const [k, meta] of collectTypeKeys(entry)) {
      const existing = keys.get(k) ?? {};
      keys.set(k, {
        description: existing.description ?? meta.description,
        deprecated: existing.deprecated ?? meta.deprecated,
        deprecationReason: existing.deprecationReason ?? meta.deprecationReason,
      });
    }
  }
  return keys;
}

export function makeSpecRef(
  spec: ApiSpec,
  registry: ExportRegistry,
  exportName: string,
  member?: string,
): SpecRef {
  const ref: SpecRef = { export: exportName };
  if (member) {
    ref.member = member;
    const mem = findMember(spec, exportName, member);
    const dep = registry.deprecatedMembers.get(member);
    const meta = typeKeyMeta(spec, exportName).get(member);
    const note =
      mem?.deprecationReason ??
      meta?.deprecationReason ??
      (dep?.parents.has(exportName) ? dep.note : '') ??
      '';
    const deprecated =
      mem?.deprecated === true ||
      meta?.deprecated === true ||
      dep?.parents.has(exportName) === true;
    if (deprecated) ref.deprecated = true;
    if (note) {
      ref.deprecationNote = note;
      const replacement = parseDeprecationReplacement(note);
      if (replacement) ref.replacement = replacement;
    }
    const sig = mem?.signatures?.[0];
    ref.signature = formatCallSig(`${exportName}.${member}`, sig);
  } else {
    const exp = findExport(spec, exportName);
    if (exp?.deprecated || registry.deprecated.has(exportName)) ref.deprecated = true;
    const note = exp?.deprecationReason ?? registry.deprecated.get(exportName) ?? '';
    if (note) {
      ref.deprecationNote = note;
      const replacement = parseDeprecationReplacement(note);
      if (replacement) ref.replacement = replacement;
    }
    const sig = exp?.signatures?.[0];
    ref.signature = formatCallSig(exportName, sig);
  }
  return ref;
}

export function resolveApiName(
  spec: ApiSpec,
  registry: ExportRegistry,
  name: string,
  preferredParents?: Set<string>,
): SpecRef | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const qualified = trimmed.match(QUALIFIED);
  if (qualified) {
    const [, parent, member] = qualified;
    const parents = registry.typeMembers.get(member);
    if (registry.all.has(parent) && parents?.has(parent)) {
      return makeSpecRef(spec, registry, parent, member);
    }
    if (registry.all.has(parent) && !parents) {
      // Parent is an export; member unknown — still cite the export
      return makeSpecRef(spec, registry, parent, member);
    }
  }

  // The word `default` is a keyword or a value, never the default export.
  if (IDENT.test(trimmed) && trimmed !== 'default' && registry.all.has(trimmed)) {
    return makeSpecRef(spec, registry, trimmed);
  }

  const local = IDENT.test(trimmed) ? registry.localNames?.get(trimmed) : undefined;
  if (local) return makeSpecRef(spec, registry, local);

  const parents = registry.typeMembers.get(trimmed);
  if (!parents || parents.size === 0) return null;

  if (preferredParents) {
    for (const p of preferredParents) {
      if (parents.has(p)) return makeSpecRef(spec, registry, p, trimmed);
    }
  }
  if (parents.size === 1) {
    return makeSpecRef(spec, registry, [...parents][0], trimmed);
  }
  const dep = registry.deprecatedMembers.get(trimmed);
  if (dep && dep.parents.size === 1 && parents.size === dep.parents.size) {
    return makeSpecRef(spec, registry, [...dep.parents][0], trimmed);
  }
  return null;
}

/** `type Schema = ZodType<...>`: the entry an alias stands for. */
function aliasTarget(spec: ApiSpec, name: string): string | undefined {
  const entry = findTypeEntry(spec, name);
  if (!entry || (entry.kind !== 'type' && entry.kind !== 'alias')) return undefined;
  const schema = entry.schema;
  if (!schema || typeof schema !== 'object') return undefined;
  const s = schema as Record<string, unknown>;
  const raw =
    typeof s.$ref === 'string'
      ? s.$ref.split('/').pop()
      : typeof s['x-ts-type'] === 'string'
        ? s['x-ts-type']
        : undefined;
  const head = raw?.replace(/<[\s\S]*$/, '').trim();
  return head && head !== name && IDENT.test(head) && findTypeEntry(spec, head) ? head : undefined;
}

/**
 * A dotted name (`.meta()`) is `Type.member` or nothing, never a top-level
 * export: the heading ancestor that has the member, else the one type that has
 * it, else the one ancestor every owner inherits it from (`inheritedFrom`; an
 * alias of that ancestor is the ancestor). Several unrelated owners: null.
 */
export function resolveMemberName(
  spec: ApiSpec,
  registry: ExportRegistry,
  name: string,
  preferredParents?: Set<string>,
): SpecRef | null {
  const member = name.trim();
  if (!IDENT.test(member)) return null;
  // `util.extend` is a namespace function, reached by its qualified name only.
  const parents = new Set(
    [...(registry.typeMembers.get(member) ?? [])].filter(
      (p) => findTypeEntry(spec, p)?.kind !== 'namespace',
    ),
  );
  if (parents.size === 0) return null;
  for (const p of preferredParents ?? []) {
    if (parents.has(p)) return makeSpecRef(spec, registry, p, member);
  }
  if (parents.size === 1) return makeSpecRef(spec, registry, [...parents][0], member);
  const origins = new Set<string>();
  for (const parent of parents) {
    origins.add(memberOrigin(spec, parents, parent, member, new Set()) ?? parent);
    if (origins.size > 1) return null;
  }
  const [origin] = origins;
  return origin && parents.has(origin) ? makeSpecRef(spec, registry, origin, member) : null;
}

/**
 * The type `parent.member` comes from: `inheritedFrom`, else the furthest base
 * (or alias target) that has it, else `parent` when it has the member itself.
 */
function memberOrigin(
  spec: ApiSpec,
  owners: ReadonlySet<string>,
  parent: string,
  member: string,
  seen: Set<string>,
): string | undefined {
  if (seen.has(parent)) return undefined;
  seen.add(parent);
  const inherited = findMember(spec, parent, member)?.inheritedFrom;
  if (inherited) return inherited;
  const entries = [...(spec.exports ?? []), ...(spec.types ?? [])].filter((e) => e.name === parent);
  const bases = [aliasTarget(spec, parent), ...entries.flatMap((e) => heritageNames(e.extends))];
  for (const base of bases) {
    const origin = base ? memberOrigin(spec, owners, base, member, seen) : undefined;
    if (origin) return origin;
  }
  return owners.has(parent) ? parent : undefined;
}

export function resolveCall(
  spec: ApiSpec,
  registry: ExportRegistry,
  objectName: string,
  methodName: string,
  derivedType?: string,
): SpecRef | null {
  if (derivedType) {
    const parents = registry.typeMembers.get(methodName);
    const dep = registry.deprecatedMembers.get(methodName);
    if (parents?.has(derivedType) || dep?.parents.has(derivedType)) {
      return makeSpecRef(spec, registry, derivedType, methodName);
    }
  }
  if (registry.all.has(objectName)) {
    return makeSpecRef(spec, registry, objectName, methodName);
  }
  const preferred = derivedType ? new Set([derivedType]) : undefined;
  return resolveApiName(spec, registry, methodName, preferred);
}

export function specSliceBody(spec: ApiSpec, ref: SpecRef): string {
  if (ref.signature) return ref.signature;
  if (ref.member) return `${ref.export}.${ref.member}`;
  const entry = findTypeEntry(spec, ref.export) ?? findExport(spec, ref.export);
  if (!entry) return ref.export;
  return entry.name;
}

export function uniqueSlices(spec: ApiSpec, refs: SpecRef[]): SpecSlice[] {
  const seen = new Set<string>();
  const slices: SpecSlice[] = [];
  const sorted = [...refs].sort((a, b) => {
    const ae = a.export.localeCompare(b.export);
    if (ae !== 0) return ae;
    return (a.member ?? '').localeCompare(b.member ?? '');
  });
  for (const ref of sorted) {
    const key = `${ref.export}.${ref.member ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const body = specSliceBody(spec, ref);
    slices.push({ ...ref, ...(body ? { body } : {}) });
  }
  return slices;
}

export function specRefKey(ref: SpecRef | null): string | null {
  if (!ref) return null;
  return ref.member ? `${ref.export}.${ref.member}` : ref.export;
}
