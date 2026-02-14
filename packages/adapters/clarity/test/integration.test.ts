import { describe, expect, test } from 'bun:test';
import type { ClarityContract } from '@secondlayer/clarity-types';
import type { ContractDoc } from '@secondlayer/clarity-docs';
import { toApiSpec } from '../src/to-api-spec';
import { computeDrift } from '@driftdev/sdk/analysis';

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

// ─── E2E: toApiSpec → computeDrift ──────────────────────────────────────────

describe('integration: clarity → computeDrift', () => {
  test('fully documented contract → zero drift', () => {
    const abi: ClarityContract = {
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
      ],
    };

    const docs = emptyDocs({
      functions: new Map([
        [
          'transfer',
          {
            target: 'function',
            functionName: 'transfer',
            access: 'public',
            desc: 'Transfer tokens',
            params: [
              { name: 'amount', description: 'Amount to transfer' },
              { name: 'sender', description: 'The sender' },
            ],
            ok: 'true on success',
            errs: [],
            see: [],
            examples: [],
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

    const spec = toApiSpec(abi, docs, { name: 'token', version: '1.0.0' });
    const result = computeDrift(spec);

    // Should produce no drift for well-documented fn
    const drifts = result.exports.get('transfer') ?? [];
    expect(drifts).toHaveLength(0);
  });

  test('wrong param name → detects param-mismatch drift', () => {
    const abi: ClarityContract = {
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
      ],
    };

    // Document a param name that doesn't exist in the ABI
    const docs = emptyDocs({
      functions: new Map([
        [
          'transfer',
          {
            target: 'function',
            functionName: 'transfer',
            access: 'public',
            desc: 'Transfer tokens',
            params: [
              { name: 'amount', description: 'Amount to transfer' },
              { name: 'from', description: 'Wrong name, should be sender' },
            ],
            ok: 'true',
            errs: [],
            see: [],
            examples: [],
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
    const result = computeDrift(spec);
    const drifts = result.exports.get('transfer') ?? [];

    // Should detect "from" as a documented param not in the signature
    expect(drifts.length).toBeGreaterThan(0);
    const paramDrift = drifts.find((d) => d.type === 'param-mismatch');
    expect(paramDrift).toBeDefined();
    expect(paramDrift!.target).toBe('from');
  });

  test('partially documented params → no false drift (coverage gap, not drift)', () => {
    const abi: ClarityContract = {
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
    };

    // Only document 1 of 3 params — this is a coverage gap, not drift
    const docs = emptyDocs({
      functions: new Map([
        [
          'transfer',
          {
            target: 'function',
            functionName: 'transfer',
            access: 'public',
            desc: 'Transfer tokens',
            params: [{ name: 'amount', description: 'Amount to transfer' }],
            ok: 'true',
            errs: [],
            see: [],
            examples: [],
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
    const result = computeDrift(spec);
    const drifts = result.exports.get('transfer') ?? [];

    // No drift — documented param 'amount' IS in the signature.
    // Missing docs for sender/recipient is a coverage concern, not drift.
    expect(drifts).toHaveLength(0);
  });

  test('full contract → toApiSpec produces valid ApiSpec', () => {
    const abi: ClarityContract = {
      functions: [
        { name: 'mint', access: 'public', args: [{ name: 'amount', type: 'uint128' }], outputs: { response: { ok: 'bool', error: 'uint128' } } },
        { name: 'get-balance', access: 'read-only', args: [{ name: 'who', type: 'principal' }], outputs: 'uint128' },
        { name: 'check-auth', access: 'private', args: [], outputs: 'bool' },
      ],
      maps: [{ name: 'balances', key: 'principal', value: 'uint128' }],
      variables: [
        { name: 'total-supply', type: 'uint128', access: 'variable' },
        { name: 'CONTRACT_OWNER', type: 'principal', access: 'constant' },
      ],
      fungible_tokens: [{ name: 'my-ft' }],
      non_fungible_tokens: [{ name: 'my-nft', type: 'uint128' }],
      defined_traits: [
        {
          name: 'sip-010',
          functions: [
            { name: 'transfer', access: 'public', args: [{ name: 'amount', type: 'uint128' }], outputs: { response: { ok: 'bool', error: 'uint128' } } },
          ],
        },
      ],
    };

    const spec = toApiSpec(abi, emptyDocs(), { name: 'full-contract', version: '1.0.0' });

    // Should have all exports: 3 fns + 1 map + 2 vars + 1 ft + 1 nft + 1 trait = 9
    expect(spec.exports).toHaveLength(9);
    expect(spec.meta.name).toBe('full-contract');

    // computeDrift should not throw
    const result = computeDrift(spec);
    expect(result.exports).toBeDefined();
  });
});
