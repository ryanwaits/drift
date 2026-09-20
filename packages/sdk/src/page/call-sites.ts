import type { ApiSchema, ApiSignature, ApiSignatureParameter, ApiSpec } from '../analysis/api-spec';
import type { ExportRegistry } from '../analysis/drift/types';
import { findTypeEntry } from '../analysis/key-coverage';
import type { CallSite } from './fences';
import { extractCallSites } from './fences';
import { signaturesOf } from './spec-ref';

export type CallSiteRuleType =
  | 'prose-unknown-key'
  | 'prose-arity-mismatch'
  | 'prose-missing-required';

export type CallSiteHit = {
  type: CallSiteRuleType;
  issue: string;
  suggestion?: string;
  exportName: string;
  member?: string;
  text: string;
  line: number;
};

type ParamShape = {
  name: string;
  required: boolean;
  rest: boolean;
  keys: Set<string>;
  requiredKeys: Set<string>;
};

type OverloadShape = {
  params: ParamShape[];
  maxPositional: number;
  allKeys: Set<string>;
};

const JSX_RESERVED = new Set(['key', 'ref']);

function schemaKeys(
  spec: ApiSpec,
  schema: ApiSchema | undefined,
  seen: Set<string>,
): { keys: Set<string>; required: Set<string> } {
  const keys = new Set<string>();
  const required = new Set<string>();
  if (schema === undefined || schema === null) return { keys, required };
  if (typeof schema === 'string') {
    if (seen.has(schema)) return { keys, required };
    seen.add(schema);
    const entry = findTypeEntry(spec, schema);
    if (!entry) return { keys, required };
    return mergeKeys(schemaKeys(spec, entry.schema, seen), memberNames(entry));
  }
  if (typeof schema !== 'object') return { keys, required };
  const s = schema as Record<string, unknown>;
  if (typeof s.$ref === 'string') {
    const name = s.$ref.split('/').pop() ?? '';
    if (name && !seen.has(name)) {
      seen.add(name);
      const entry = findTypeEntry(spec, name);
      if (entry) {
        const inner = mergeKeys(schemaKeys(spec, entry.schema, seen), memberNames(entry));
        for (const k of inner.keys) keys.add(k);
        for (const k of inner.required) required.add(k);
      }
    }
  }
  if (Array.isArray(s.allOf)) {
    for (const m of s.allOf) {
      const inner = schemaKeys(spec, m as ApiSchema, seen);
      for (const k of inner.keys) keys.add(k);
      for (const k of inner.required) required.add(k);
    }
  }
  if (typeof s.properties === 'object' && s.properties !== null) {
    for (const k of Object.keys(s.properties as Record<string, unknown>)) keys.add(k);
  }
  if (Array.isArray(s.required)) {
    for (const k of s.required) if (typeof k === 'string') required.add(k);
  }
  return { keys, required };
}

function memberNames(entry: { members?: Array<{ name?: string }> }): {
  keys: Set<string>;
  required: Set<string>;
} {
  const keys = new Set<string>();
  for (const m of entry.members ?? []) if (m.name) keys.add(m.name);
  return { keys, required: new Set() };
}

function mergeKeys(
  a: { keys: Set<string>; required: Set<string> },
  b: { keys: Set<string>; required: Set<string> },
): { keys: Set<string>; required: Set<string> } {
  return {
    keys: new Set([...a.keys, ...b.keys]),
    required: new Set([...a.required, ...b.required]),
  };
}

function paramShape(spec: ApiSpec, p: ApiSignatureParameter): ParamShape {
  const { keys, required: requiredKeys } = schemaKeys(spec, p.schema, new Set());
  return {
    name: p.name,
    required: p.required !== false && p.default === undefined && !p.rest,
    rest: !!p.rest,
    keys,
    requiredKeys,
  };
}

function overloadShape(spec: ApiSpec, sig: ApiSignature): OverloadShape {
  const params = (sig.parameters ?? []).map((p) => paramShape(spec, p));
  const rest = params.some((p) => p.rest);
  const allKeys = new Set<string>();
  for (const p of params) {
    allKeys.add(p.name);
    for (const k of p.keys) allKeys.add(k);
  }
  return { params, maxPositional: rest ? Number.POSITIVE_INFINITY : params.length, allKeys };
}

function resolveCallee(
  site: CallSite,
  registry: ExportRegistry,
  bindings: Map<string, string>,
): { exportName: string; member?: string } | null {
  if (site.objectName) {
    if (registry.all.has(site.objectName)) {
      return { exportName: site.objectName, member: site.name };
    }
    const bound = bindings.get(site.objectName);
    if (!bound) return null;
    const resolved = registry.callableReturnTypes.get(bound) ?? bound;
    if (!registry.all.has(resolved) && !registry.typeNames.includes(resolved)) return null;
    return { exportName: resolved, member: site.name };
  }
  if (registry.all.has(site.name)) return { exportName: site.name };
  return null;
}

function displayName(callee: { exportName: string; member?: string }, site: CallSite): string {
  if (site.kind === 'jsx')
    return `<${site.objectName ? `${site.objectName}.${site.name}` : site.name}>`;
  if (callee.member) return `${callee.exportName}.${callee.member}`;
  return callee.exportName;
}

function allowedKeys(overloads: OverloadShape[], site: CallSite): Set<string> {
  const allowed = new Set<string>();
  for (const ov of overloads) for (const k of ov.allKeys) allowed.add(k);
  if (site.kind === 'jsx') for (const k of JSX_RESERVED) allowed.add(k);
  return allowed;
}

function explicitKeys(site: CallSite): string[] {
  if (site.kind === 'jsx') return site.jsxKeys.filter((k) => !JSX_RESERVED.has(k));
  const keys: string[] = [];
  for (const arg of site.args) {
    if (arg.keys) keys.push(...arg.keys);
  }
  return keys;
}

function missingRequired(overloads: OverloadShape[], site: CallSite): string[] {
  if (site.hasSpreadArg || site.hasJsxSpread) return [];
  let required: Set<string> | null = null;
  for (const ov of overloads) {
    const names = new Set<string>();
    if (site.kind === 'jsx') {
      const p0 = ov.params[0];
      if (p0) for (const k of p0.requiredKeys) names.add(k);
    } else {
      ov.params.forEach((p, i) => {
        if (p.rest) return;
        if (p.requiredKeys.size > 0) {
          for (const k of p.requiredKeys) names.add(k);
        } else if (p.required) {
          names.add(`param:${i}:${p.name}`);
        }
      });
    }
    if (required === null) required = names;
    else {
      const next = new Set<string>();
      for (const n of required) if (names.has(n)) next.add(n);
      required = next;
    }
  }
  if (!required || required.size === 0) return [];

  const supplied = new Set<string>();
  if (site.kind === 'jsx') {
    for (const k of site.jsxKeys) supplied.add(k);
    if (site.hasChildren) supplied.add('children');
  } else {
    let nonLiteral = false;
    for (const arg of site.args) {
      if (arg.keys) for (const k of arg.keys) supplied.add(k);
      else if (!arg.hasSpread) nonLiteral = true;
    }
    const missing: string[] = [];
    for (const slot of required) {
      if (slot.startsWith('param:')) {
        const parts = slot.split(':');
        const i = Number(parts[1]);
        if (site.argCount <= i) missing.push(parts[2]);
      } else if (!supplied.has(slot)) {
        if (nonLiteral && site.argCount > 0) continue;
        missing.push(slot);
      }
    }
    return missing;
  }

  return [...required].filter((k) => !supplied.has(k));
}

function judgeSite(
  site: CallSite,
  spec: ApiSpec,
  registry: ExportRegistry,
  bindings: Map<string, string>,
): CallSiteHit[] {
  const callee = resolveCallee(site, registry, bindings);
  if (!callee) return [];
  const sigs = signaturesOf(spec, callee.exportName, callee.member);
  if (sigs.length === 0) return [];
  const overloads = sigs.map((s) => overloadShape(spec, s));
  const hits: CallSiteHit[] = [];
  const label = displayName(callee, site);
  const base = {
    exportName: callee.exportName,
    member: callee.member,
    text: site.text,
    line: site.line,
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

  const allowed = allowedKeys(overloads, site);
  const known = [...allowed].filter((k) => !JSX_RESERVED.has(k));
  const unknown = explicitKeys(site).filter((k) => !allowed.has(k));
  if (unknown.length > 0 && known.length > 0) {
    const kind = site.kind === 'jsx' ? 'prop' : 'key';
    hits.push({
      ...base,
      type: 'prose-unknown-key',
      issue: `Unknown ${kind} '${unknown.join("', '")}' on '${label}'`,
      suggestion: `Allowed: ${
        [...allowed]
          .filter((k) => !JSX_RESERVED.has(k))
          .sort()
          .join(', ') || '(none)'
      }`,
    });
  }

  const missing = missingRequired(overloads, site);
  if (missing.length > 0) {
    const kind = site.kind === 'jsx' ? 'prop' : 'argument';
    hits.push({
      ...base,
      type: 'prose-missing-required',
      issue: `${site.kind === 'jsx' ? 'JSX' : 'Call'} '${label}' is missing required ${kind} '${missing.join("', '")}'`,
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
): CallSiteHit[] {
  const hits: CallSiteHit[] = [];
  for (const site of extractCallSites(code)) {
    hits.push(...judgeSite(site, spec, registry, bindings));
  }
  return hits;
}
