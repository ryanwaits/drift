import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const TMP = path.resolve(__dirname, '.tmp-primitives-multilang');

const SPEC = {
  openapi: '3.1.0',
  info: { title: 'Acme API', version: '2.1.0' },
  paths: {
    '/user.info': {
      post: {
        operationId: 'userInfo',
        summary: 'user.info',
        description: 'Fetches a single user by id.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string', description: 'The user id' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'The user',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/User' } },
            },
          },
        },
      },
    },
    '/user.list': {
      post: {
        operationId: 'userList',
        deprecated: true,
        responses: { '200': { description: 'All users' } },
      },
    },
  },
  components: {
    schemas: {
      User: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
    },
  },
};

const CLAR_ABI = {
  functions: [
    {
      name: 'transfer',
      access: 'public' as const,
      args: [{ name: 'amount', type: 'uint128' }],
      outputs: { response: { ok: 'bool', error: 'uint128' } },
    },
  ],
};

const CLAR_SOURCE = `
;; @desc Transfer tokens
;; @param amount Amount to transfer
(define-public (transfer (amount uint))
  (ok true)
)
`;

const CLI = path.resolve(__dirname, '../src/drift.ts');

function run(args: string[], cwd?: string) {
  return Bun.spawnSync(['bun', 'run', CLI, ...args], {
    cwd: cwd ?? TMP,
    env: { ...process.env, NO_COLOR: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
}

function json(args: string[]) {
  const result = run([...args, '--json']);
  return JSON.parse(result.stdout.toString());
}

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(path.join(TMP, 'acme-api.json'), JSON.stringify(SPEC));
  writeFileSync(path.join(TMP, 'token.clar'), CLAR_SOURCE);
  writeFileSync(path.join(TMP, 'token.abi.json'), JSON.stringify(CLAR_ABI));
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('multi-lang primitives — openapi (--spec implies lang)', () => {
  test('extract --spec outputs ApiSpec', () => {
    const envelope = json(['extract', '--spec', 'acme-api.json']);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.meta.name).toBe('Acme API');
    expect(envelope.data.exports).toHaveLength(2);
    expect(envelope.data.types).toHaveLength(1);
  });

  test('list --spec lists operations', () => {
    const envelope = json(['list', '--spec', 'acme-api.json']);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.exports.map((e: { name: string }) => e.name).sort()).toEqual([
      'userInfo',
      'userList',
    ]);
  });

  test('list positional is a search term for openapi', () => {
    const envelope = json(['list', 'userInfo', '--spec', 'acme-api.json']);
    expect(envelope.data.search).toBe('userInfo');
    expect(envelope.data.exports[0].name).toBe('userInfo');
  });

  test('list --undocumented filters', () => {
    const envelope = json(['list', '--undocumented', '--spec', 'acme-api.json']);
    expect(envelope.data.exports.map((e: { name: string }) => e.name)).toEqual(['userList']);
  });

  test('get <name> --spec returns operation detail', () => {
    const envelope = json(['get', 'userInfo', '--spec', 'acme-api.json']);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.export.name).toBe('userInfo');
    expect(envelope.data.export.description).toBe('Fetches a single user by id.');
    const params = envelope.data.export.parameters;
    expect(params).toHaveLength(1);
    expect(params[0]).toMatchObject({ name: 'id', required: true, description: 'The user id' });
    expect(params[0].schema).toMatchObject({ type: 'string' });
    expect(envelope.data.export.returns.schema).toMatchObject({ type: 'object' });
    expect(envelope.data.export.flags).toMatchObject({ method: 'POST', path: '/user.info' });
  });

  test('get unknown name suggests similar', () => {
    const result = run(['get', 'userInfoo', '--spec', 'acme-api.json', '--json']);
    expect(result.stdout.toString()).toContain('userInfo');
    expect(result.exitCode).toBe(1);
  });

  test('coverage --spec', () => {
    const envelope = json(['coverage', '--spec', 'acme-api.json']);
    expect(envelope.data.total).toBe(2);
    expect(envelope.data.documented).toBe(1);
    expect(envelope.data.undocumented).toEqual(['userList']);
  });

  test('lint --spec runs computeDrift without prose drift', () => {
    const envelope = json(['lint', '--spec', 'acme-api.json']);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.count).toBe(0);
  });

  test('health --spec reports package meta from spec', () => {
    const envelope = json(['health', '--spec', 'acme-api.json']);
    expect(envelope.data.packageName).toBe('Acme API');
    expect(envelope.data.packageVersion).toBe('2.1.0');
    expect(envelope.data.health).toBeGreaterThanOrEqual(0);
  });

  test('--all guarded for non-TS', () => {
    const result = run(['list', '--all', '--spec', 'acme-api.json', '--json']);
    expect(result.stdout.toString()).toContain('not yet supported');
  });
});

describe('multi-lang primitives — clarity inference', () => {
  test('.clar entry + --abi infers clarity (no --lang)', () => {
    const envelope = json(['scan', '--abi', 'token.abi.json', 'token.clar']);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.packageName).toBe('token');
  });

  test('get on clarity source: entry-first positional form', () => {
    const envelope = json(['get', 'token.clar', 'transfer', '--abi', 'token.abi.json']);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.export.name).toBe('transfer');
    expect(envelope.data.export.parameters[0].name).toBe('amount');
  });

  test('list on clarity source', () => {
    const envelope = json(['list', 'token.clar', '--abi', 'token.abi.json']);
    expect(envelope.data.exports.map((e: { name: string }) => e.name)).toContain('transfer');
  });

  test('unknown --lang still errors', () => {
    const result = run(['extract', '--lang', 'cobol', '--json']);
    expect(result.stdout.toString()).toContain('Unknown language');
  });
});
