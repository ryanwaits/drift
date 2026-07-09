import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const TMP = path.resolve(__dirname, '.tmp-scan-openapi');

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
        responses: { '200': { description: 'All users' } },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' } },
      },
    },
  },
};

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
  writeFileSync(path.join(TMP, 'acme-api.json'), JSON.stringify(SPEC));
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('drift scan --lang openapi', () => {
  test('produces valid scan result with coverage + health', () => {
    const result = run(['scan', '--lang', 'openapi', '--spec', 'acme-api.json', '--json']);
    expect(result.exitCode).toBe(0);

    const envelope = JSON.parse(result.stdout.toString());
    expect(envelope.ok).toBe(true);
    expect(envelope.meta.command).toBe('scan');
    expect(envelope.data.coverage.total).toBe(2); // userInfo + userList
    expect(envelope.data.coverage.documented).toBe(1); // only userInfo has description
    expect(envelope.data.health).toBeGreaterThanOrEqual(0);
    expect(envelope.data.health).toBeLessThanOrEqual(100);
    expect(envelope.data.packageName).toBe('Acme API');
    expect(envelope.data.packageVersion).toBe('2.1.0');
  });

  test('--spec required error', () => {
    const result = run(['scan', '--lang', 'openapi', '--json']);
    expect(result.stdout.toString()).toContain('--spec is required');
  });

  test('unknown --lang error', () => {
    const result = run(['scan', '--lang', 'graphql', '--spec', 'acme-api.json', '--json']);
    expect(result.stdout.toString()).toContain('Unknown language');
  });

  test('--lang openapi --all error', () => {
    const result = run(['scan', '--lang', 'openapi', '--spec', 'acme-api.json', '--all', '--json']);
    expect(result.stdout.toString()).toContain('not yet supported');
  });

  test('missing spec file error', () => {
    const result = run(['scan', '--lang', 'openapi', '--spec', 'nope.json', '--json']);
    expect(result.stdout.toString()).toContain('Spec file not found');
  });
});
