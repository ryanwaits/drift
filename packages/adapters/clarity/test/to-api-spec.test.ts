import { describe, expect, test } from 'bun:test';
import type { ClarityContract } from '@secondlayer/clarity-types';
import type { ContractDoc } from '@secondlayer/clarity-docs';
import { toApiSpec } from '../src/to-api-spec';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyDocs(overrides?: Partial<ContractDoc>): ContractDoc {
  return {
    header: { see: [], implements: [], custom: new Map() },
    functions: new Map(),
    maps: new Map(),
    variables: new Map(),
    constants: new Map(),
    traits: new Map(),
    ...overrides,
  } as ContractDoc;
}

function minimalAbi(overrides?: Partial<ClarityContract>): ClarityContract {
  return { functions: [], ...overrides } as ClarityContract;
}

// ─── Function mapping ────────────────────────────────────────────────────────

describe('toApiSpec — functions', () => {
  test('public fn with full docs', () => {
    const abi = minimalAbi({
      functions: [
        {
          name: 'transfer',
          access: 'public',
          args: [
            { name: 'amount', type: 'uint128' },
            { name: 'sender', type: 'principal' },
            { name: 'recipient', type: 'principal' },
          ],
          outputs: { response: { ok: 'bool', error: 'uint128' } },
        },
      ],
    });

    const docs = emptyDocs({
      functions: new Map([
        [
          'transfer',
          {
            target: 'function',
            functionName: 'transfer',
            access: 'public',
            desc: 'Transfers tokens between principals',
            dev: 'Emits a transfer event',
            ok: 'true on success',
            params: [
              { name: 'amount', description: 'Number of tokens' },
              { name: 'sender', description: 'Token sender' },
              { name: 'recipient', description: 'Token recipient' },
            ],
            errs: [{ code: 'u1', description: 'Insufficient balance' }],
            see: ['get-balance'],
            examples: ['(contract-call? .token transfer u100 tx-sender recipient)'],
            caller: 'tx-sender must be sender',
            posts: [],
            prints: [],
            calls: [],
            tags: [],
            rawText: '',
            startLine: 1,
            endLine: 10,
          } as any,
        ],
      ]),
    });

    const spec = toApiSpec(abi, docs, { name: 'token' });
    const exp = spec.exports[0];

    expect(exp.id).toBe('transfer');
    expect(exp.kind).toBe('function');
    expect(exp.description).toBe('Transfers tokens between principals');
    expect(exp.flags).toEqual({ access: 'public' });

    // Signatures
    expect(exp.signatures).toHaveLength(1);
    const sig = exp.signatures![0];
    expect(sig.parameters).toHaveLength(3);
    expect(sig.parameters![0].name).toBe('amount');
    expect(sig.parameters![0].schema).toBe('uint128');
    expect(sig.parameters![0].description).toBe('Number of tokens');
    expect(sig.returns?.schema).toEqual({
      type: 'response',
      ok: 'bool',
      error: 'uint128',
    });

    // Tags
    const tagNames = exp.tags!.map((t) => t.name);
    expect(tagNames).toContain('param');
    expect(tagNames).toContain('returns');
    expect(tagNames).toContain('throws');
    expect(tagNames).toContain('see');
    expect(tagNames).toContain('remarks');
    expect(tagNames).toContain('caller');

    // Examples
    expect(exp.examples).toEqual([
      '(contract-call? .token transfer u100 tx-sender recipient)',
    ]);
  });

  test('read-only fn → flags.access = read-only', () => {
    const abi = minimalAbi({
      functions: [
        { name: 'get-balance', access: 'read-only', args: [{ name: 'who', type: 'principal' }], outputs: 'uint128' },
      ],
    });
    const spec = toApiSpec(abi, emptyDocs(), { name: 'token' });
    expect(spec.exports[0].flags).toEqual({ access: 'read-only' });
  });

  test('private fn → flags.access = private', () => {
    const abi = minimalAbi({
      functions: [
        { name: 'check-owner', access: 'private', args: [], outputs: 'bool' },
      ],
    });
    const spec = toApiSpec(abi, emptyDocs(), { name: 'token' });
    expect(spec.exports[0].flags).toEqual({ access: 'private' });
  });

  test('params with FunctionDoc descriptions → signatures[0].parameters', () => {
    const abi = minimalAbi({
      functions: [
        { name: 'mint', access: 'public', args: [{ name: 'amount', type: 'uint128' }], outputs: 'bool' },
      ],
    });
    const docs = emptyDocs({
      functions: new Map([
        [
          'mint',
          {
            target: 'function',
            functionName: 'mint',
            access: 'public',
            params: [{ name: 'amount', description: 'Tokens to mint' }],
            errs: [],
            see: [],
            examples: [],
            posts: [],
            prints: [],
            calls: [],
            tags: [],
            rawText: '',
            startLine: 1,
            endLine: 5,
          } as any,
        ],
      ]),
    });
    const spec = toApiSpec(abi, docs, { name: 'token' });
    expect(spec.exports[0].signatures![0].parameters![0].description).toBe('Tokens to mint');
  });

  test('@err tags → tags with name=throws', () => {
    const abi = minimalAbi({
      functions: [
        { name: 'burn', access: 'public', args: [], outputs: { response: { ok: 'bool', error: 'uint128' } } },
      ],
    });
    const docs = emptyDocs({
      functions: new Map([
        [
          'burn',
          {
            target: 'function',
            functionName: 'burn',
            access: 'public',
            params: [],
            errs: [
              { code: 'u1', description: 'Not authorized' },
              { code: 'u2', description: 'Insufficient balance' },
            ],
            see: [],
            examples: [],
            posts: [],
            prints: [],
            calls: [],
            tags: [],
            rawText: '',
            startLine: 1,
            endLine: 5,
          } as any,
        ],
      ]),
    });
    const spec = toApiSpec(abi, docs, { name: 'token' });
    const throwsTags = spec.exports[0].tags!.filter((t) => t.name === 'throws');
    expect(throwsTags).toHaveLength(2);
    expect(throwsTags[0].text).toBe('u1: Not authorized');
    expect(throwsTags[1].text).toBe('u2: Insufficient balance');
  });

  test('examples populated from FunctionDoc', () => {
    const abi = minimalAbi({
      functions: [
        { name: 'foo', access: 'public', args: [], outputs: 'bool' },
      ],
    });
    const docs = emptyDocs({
      functions: new Map([
        [
          'foo',
          {
            target: 'function',
            functionName: 'foo',
            access: 'public',
            params: [],
            errs: [],
            see: [],
            examples: ['(contract-call? .c foo)', '(contract-call? .c foo)'],
            posts: [],
            prints: [],
            calls: [],
            tags: [],
            rawText: '',
            startLine: 1,
            endLine: 5,
          } as any,
        ],
      ]),
    });
    const spec = toApiSpec(abi, docs, { name: 'test' });
    expect(spec.exports[0].examples).toHaveLength(2);
  });

  test('undocumented fn → no description, drift-detectable', () => {
    const abi = minimalAbi({
      functions: [
        { name: 'undoc', access: 'public', args: [{ name: 'x', type: 'uint128' }], outputs: 'bool' },
      ],
    });
    const spec = toApiSpec(abi, emptyDocs(), { name: 'test' });
    const exp = spec.exports[0];
    expect(exp.description).toBeUndefined();
    expect(exp.tags).toBeUndefined();
    expect(exp.examples).toBeUndefined();
    expect(exp.signatures).toHaveLength(1);
    expect(exp.signatures![0].parameters![0].name).toBe('x');
  });
});

// ─── Maps ────────────────────────────────────────────────────────────────────

describe('toApiSpec — maps', () => {
  test('map → kind=variable, flags.clarityKind=map', () => {
    const abi = minimalAbi({
      maps: [{ name: 'balances', key: 'principal', value: 'uint128' }],
    });
    const spec = toApiSpec(abi, emptyDocs(), { name: 'token' });
    const exp = spec.exports[0];
    expect(exp.kind).toBe('variable');
    expect(exp.flags).toEqual({ clarityKind: 'map' });
    expect(exp.schema).toEqual({
      type: 'map',
      key: 'principal',
      value: 'uint128',
    });
  });
});

// ─── Variables ───────────────────────────────────────────────────────────────

describe('toApiSpec — variables', () => {
  test('data-var → flags.access = variable', () => {
    const abi = minimalAbi({
      variables: [{ name: 'total-supply', type: 'uint128', access: 'variable' }],
    });
    const spec = toApiSpec(abi, emptyDocs(), { name: 'token' });
    expect(spec.exports[0].flags).toEqual({ access: 'variable' });
  });

  test('constant → flags.access = constant', () => {
    const abi = minimalAbi({
      variables: [{ name: 'CONTRACT_OWNER', type: 'principal', access: 'constant' }],
    });
    const spec = toApiSpec(abi, emptyDocs(), { name: 'token' });
    expect(spec.exports[0].flags).toEqual({ access: 'constant' });
  });
});

// ─── Tokens ──────────────────────────────────────────────────────────────────

describe('toApiSpec — tokens', () => {
  test('FT → flags.clarityKind = ft', () => {
    const abi = minimalAbi({ fungible_tokens: [{ name: 'my-token' }] });
    const spec = toApiSpec(abi, emptyDocs(), { name: 'token' });
    expect(spec.exports[0].flags).toEqual({ clarityKind: 'ft' });
  });

  test('NFT → flags.clarityKind = nft', () => {
    const abi = minimalAbi({
      non_fungible_tokens: [{ name: 'my-nft', type: 'uint128' }],
    });
    const spec = toApiSpec(abi, emptyDocs(), { name: 'nft' });
    expect(spec.exports[0].flags).toEqual({ clarityKind: 'nft' });
    expect(spec.exports[0].schema).toBe('uint128');
  });
});

// ─── Traits ──────────────────────────────────────────────────────────────────

describe('toApiSpec — traits', () => {
  test('trait → kind=interface, members', () => {
    const abi = minimalAbi({
      defined_traits: [
        {
          name: 'sip-010',
          functions: [
            {
              name: 'transfer',
              access: 'public',
              args: [
                { name: 'amount', type: 'uint128' },
                { name: 'sender', type: 'principal' },
              ],
              outputs: { response: { ok: 'bool', error: 'uint128' } },
            },
            {
              name: 'get-balance',
              access: 'read-only',
              args: [{ name: 'who', type: 'principal' }],
              outputs: { response: { ok: 'uint128', error: 'uint128' } },
            },
          ],
        },
      ],
    });

    const spec = toApiSpec(abi, emptyDocs(), { name: 'trait-contract' });
    const exp = spec.exports[0];

    expect(exp.kind).toBe('interface');
    expect(exp.name).toBe('sip-010');
    expect(exp.members).toHaveLength(2);
    expect(exp.members![0].name).toBe('transfer');
    expect(exp.members![0].kind).toBe('function');
    expect(exp.members![0].signatures![0].parameters).toHaveLength(2);
    expect(exp.members![1].name).toBe('get-balance');
  });
});

// ─── Meta ────────────────────────────────────────────────────────────────────

describe('toApiSpec — meta', () => {
  test('version from docs header takes precedence', () => {
    const docs = emptyDocs();
    docs.header.version = '2.0.0';
    const spec = toApiSpec(minimalAbi(), docs, { name: 'token', version: '1.0.0' });
    expect(spec.meta.version).toBe('2.0.0');
  });

  test('version falls back to meta param', () => {
    const spec = toApiSpec(minimalAbi(), emptyDocs(), { name: 'token', version: '1.0.0' });
    expect(spec.meta.version).toBe('1.0.0');
  });

  test('name from meta param', () => {
    const spec = toApiSpec(minimalAbi(), emptyDocs(), { name: 'my-contract' });
    expect(spec.meta.name).toBe('my-contract');
  });
});
