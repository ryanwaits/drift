import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const TMP = path.resolve(__dirname, '.tmp-scan-clarity');

const ABI = {
  functions: [
    {
      name: 'transfer',
      access: 'public' as const,
      args: [
        { name: 'amount', type: 'uint128' },
        { name: 'sender', type: 'principal' },
      ],
      outputs: { response: { ok: 'bool', error: 'uint128' } },
    },
    {
      name: 'get-balance',
      access: 'read-only' as const,
      args: [{ name: 'who', type: 'principal' }],
      outputs: 'uint128',
    },
  ],
  maps: [{ name: 'balances', key: 'principal', value: 'uint128' }],
  variables: [{ name: 'total-supply', type: 'uint128', access: 'variable' }],
};

const SOURCE = `
;; @desc Transfer tokens between accounts
;; @param amount Amount to transfer
;; @param sender The sender principal
(define-public (transfer (amount uint) (sender principal))
  (ok true)
)

;; @desc Get balance for a principal
;; @param who The account to check
(define-read-only (get-balance (who principal))
  u0
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

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(path.join(TMP, 'token.clar'), SOURCE);
  writeFileSync(path.join(TMP, 'token.abi.json'), JSON.stringify(ABI));
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('drift scan --lang clarity', () => {
  test('produces valid scan result with coverage + health', () => {
    const result = run(['scan', '--lang', 'clarity', '--abi', 'token.abi.json', '--json', 'token.clar']);
    expect(result.exitCode).toBe(0);

    const stdout = result.stdout.toString();
    const envelope = JSON.parse(stdout);
    expect(envelope.ok).toBe(true);
    expect(envelope.meta.command).toBe('scan');
    expect(envelope.data.coverage).toBeDefined();
    expect(envelope.data.coverage.total).toBe(4); // 2 fns + 1 map + 1 var
    expect(envelope.data.coverage.documented).toBeGreaterThan(0); // transfer + get-balance have docs
    expect(envelope.data.health).toBeGreaterThanOrEqual(0);
    expect(envelope.data.health).toBeLessThanOrEqual(100);
    expect(envelope.data.pass).toBe(true);
    expect(envelope.data.packageName).toBe('token');
  });

  test('--abi required error', () => {
    const result = run(['scan', '--lang', 'clarity', '--json', 'token.clar']);
    const stdout = result.stdout.toString();
    expect(stdout).toContain('--abi is required');
  });

  test('unknown --lang error', () => {
    const result = run(['scan', '--lang', 'rust', '--json', 'token.clar']);
    const stdout = result.stdout.toString();
    expect(stdout).toContain('Unknown language');
  });

  test('--lang clarity --all error', () => {
    const result = run(['scan', '--lang', 'clarity', '--abi', 'token.abi.json', '--all', '--json']);
    const stdout = result.stdout.toString();
    expect(stdout).toContain('not yet supported');
  });

  test('derives name from filename', () => {
    const result = run(['scan', '--lang', 'clarity', '--abi', 'token.abi.json', '--json', 'token.clar']);
    const envelope = JSON.parse(result.stdout.toString());
    expect(envelope.data.packageName).toBe('token');
  });
});
