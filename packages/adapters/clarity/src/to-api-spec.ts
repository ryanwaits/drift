/**
 * Core mapping: ClarityContract + ContractDoc → ApiSpec.
 */
import type { ClarityContract } from '@secondlayer/clarity-types';
import type { ContractDoc } from '@secondlayer/clarity-docs';
import type { ApiExport, ApiMember, ApiSpec, ApiTag } from '@driftdev/sdk/types';
import { clarityTypeToSchema } from './type-mapping';

export function toApiSpec(
  abi: ClarityContract,
  docs: ContractDoc,
  meta: { name: string; version?: string },
): ApiSpec {
  const exports: ApiExport[] = [];

  // Functions
  for (const fn of abi.functions) {
    const fnDoc = docs.functions.get(fn.name);
    exports.push(mapFunction(fn, fnDoc));
  }

  // Maps
  for (const map of abi.maps ?? []) {
    const mapDoc = docs.maps.get(map.name);
    exports.push({
      id: map.name,
      name: map.name,
      kind: 'variable',
      description: mapDoc?.desc,
      deprecated: mapDoc?.deprecated ? true : undefined,
      flags: { clarityKind: 'map' },
      schema: {
        type: 'map',
        key: clarityTypeToSchema(map.key),
        value: clarityTypeToSchema(map.value),
      },
      tags: buildMapTags(mapDoc),
    });
  }

  // Variables (data-var + constant)
  for (const v of abi.variables ?? []) {
    const isConstant = v.access === 'constant';
    const vDoc = isConstant ? docs.constants.get(v.name) : docs.variables.get(v.name);
    exports.push({
      id: v.name,
      name: v.name,
      kind: 'variable',
      description: vDoc?.desc,
      deprecated: vDoc?.deprecated ? true : undefined,
      flags: { access: v.access },
      schema: clarityTypeToSchema(v.type),
      tags: buildVariableTags(vDoc),
    });
  }

  // Fungible tokens
  for (const ft of abi.fungible_tokens ?? []) {
    exports.push({
      id: ft.name,
      name: ft.name,
      kind: 'variable',
      flags: { clarityKind: 'ft' },
    });
  }

  // Non-fungible tokens
  for (const nft of abi.non_fungible_tokens ?? []) {
    exports.push({
      id: nft.name,
      name: nft.name,
      kind: 'variable',
      flags: { clarityKind: 'nft' },
      schema: clarityTypeToSchema(nft.type),
    });
  }

  // Traits
  for (const trait of abi.defined_traits ?? []) {
    const traitDoc = docs.traits.get(trait.name);
    const members: ApiMember[] = trait.functions.map((fn) => ({
      name: fn.name,
      kind: 'function',
      signatures: [
        {
          parameters: fn.args.map((arg) => ({
            name: arg.name,
            schema: clarityTypeToSchema(arg.type),
            required: true,
          })),
          returns: { schema: clarityTypeToSchema(fn.outputs) },
        },
      ],
    }));

    exports.push({
      id: trait.name,
      name: trait.name,
      kind: 'interface',
      description: traitDoc?.desc,
      deprecated: traitDoc?.deprecated ? true : undefined,
      members,
      tags: buildTraitTags(traitDoc),
    });
  }

  return {
    meta: {
      name: meta.name,
      version: docs.header.version ?? meta.version,
    },
    exports,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface FunctionLike {
  name: string;
  access: 'public' | 'read-only' | 'private';
  args: ReadonlyArray<{ name: string; type: import('@secondlayer/clarity-types').ClarityType }>;
  outputs: import('@secondlayer/clarity-types').ClarityType;
}

interface FunctionDocLike {
  desc?: string;
  dev?: string;
  deprecated?: string;
  caller?: string;
  ok?: string;
  params: Array<{ name: string; description: string }>;
  errs: Array<{ code: string; description: string }>;
  see: string[];
  examples: string[];
}

function mapFunction(fn: FunctionLike, fnDoc: FunctionDocLike | undefined): ApiExport {
  const tags: ApiTag[] = [];

  if (fnDoc) {
    // @param tags
    for (const p of fnDoc.params) {
      tags.push({ name: 'param', text: p.description, param: { name: p.name } });
    }
    // @returns (ok)
    if (fnDoc.ok) {
      tags.push({ name: 'returns', text: fnDoc.ok });
    }
    // @throws (err)
    for (const err of fnDoc.errs) {
      tags.push({ name: 'throws', text: `${err.code}: ${err.description}` });
    }
    // @see
    for (const see of fnDoc.see) {
      tags.push({ name: 'see', text: see });
    }
    // @remarks (dev)
    if (fnDoc.dev) {
      tags.push({ name: 'remarks', text: fnDoc.dev });
    }
    // @caller
    if (fnDoc.caller) {
      tags.push({ name: 'caller', text: fnDoc.caller });
    }
  }

  // Build param descriptions lookup from doc
  const paramDescs = new Map<string, string>();
  if (fnDoc) {
    for (const p of fnDoc.params) {
      paramDescs.set(p.name, p.description);
    }
  }

  return {
    id: fn.name,
    name: fn.name,
    kind: 'function',
    description: fnDoc?.desc,
    deprecated: fnDoc?.deprecated ? true : undefined,
    flags: { access: fn.access },
    tags: tags.length > 0 ? tags : undefined,
    examples: fnDoc?.examples && fnDoc.examples.length > 0 ? fnDoc.examples : undefined,
    signatures: [
      {
        parameters: fn.args.map((arg) => ({
          name: arg.name,
          schema: clarityTypeToSchema(arg.type),
          required: true,
          description: paramDescs.get(arg.name),
        })),
        returns: { schema: clarityTypeToSchema(fn.outputs) },
      },
    ],
  };
}

function buildMapTags(
  doc: { dev?: string; see: string[] } | undefined,
): ApiTag[] | undefined {
  if (!doc) return undefined;
  const tags: ApiTag[] = [];
  if (doc.dev) tags.push({ name: 'remarks', text: doc.dev });
  for (const see of doc.see) tags.push({ name: 'see', text: see });
  return tags.length > 0 ? tags : undefined;
}

function buildVariableTags(
  doc: { dev?: string; see: string[] } | undefined,
): ApiTag[] | undefined {
  if (!doc) return undefined;
  const tags: ApiTag[] = [];
  if (doc.dev) tags.push({ name: 'remarks', text: doc.dev });
  for (const see of doc.see) tags.push({ name: 'see', text: see });
  return tags.length > 0 ? tags : undefined;
}

function buildTraitTags(
  doc: { dev?: string; see: string[] } | undefined,
): ApiTag[] | undefined {
  if (!doc) return undefined;
  const tags: ApiTag[] = [];
  if (doc.dev) tags.push({ name: 'remarks', text: doc.dev });
  for (const see of doc.see) tags.push({ name: 'see', text: see });
  return tags.length > 0 ? tags : undefined;
}
