import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const TMP = path.resolve(__dirname, '.tmp-page');
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
  return {
    envelope: JSON.parse(result.stdout.toString()),
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
  };
}

beforeAll(() => {
  mkdirSync(path.join(TMP, 'docs'), { recursive: true });
  writeFileSync(
    path.join(TMP, 'package.json'),
    JSON.stringify({ name: '@stacks/clarinet-sdk', version: '1.0.0' }),
  );
  writeFileSync(
    path.join(TMP, 'index.ts'),
    [
      'export class Simnet {',
      '  /** @deprecated use simnet.execute(command) instead */',
      '  runSnippet(command: string): string { return command; }',
      '  execute(snippet: string): string { return snippet; }',
      '}',
      'export async function initSimnet(): Promise<Simnet> { return new Simnet(); }',
    ].join('\n'),
  );
  writeFileSync(
    path.join(TMP, 'docs', 'browser-sdk-reference.md'),
    [
      '# Browser SDK reference',
      '',
      '## Empty session',
      '',
      '```ts',
      'const simnet = await initSimnet()',
      'simnet.runSnippet("(+ 1 2)")',
      '```',
      '',
    ].join('\n'),
  );
  writeFileSync(
    path.join(TMP, 'drift.docs.json'),
    JSON.stringify({
      version: 1,
      pages: [
        { page: 'docs/browser-sdk-reference.md', type: 'Simnet' },
        { page: 'docs/sdk-reference.md', type: 'Simnet' },
      ],
    }),
  );
  writeFileSync(
    path.join(TMP, 'docs', 'sdk-reference.md'),
    [
      '# SDK reference',
      '',
      '## runSnippet',
      '',
      'executes arbitrary Clarity code without deploying',
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('drift page --json', () => {
  test('browser fence is prose-deprecated-reference', () => {
    const { envelope, exitCode } = json(['page', 'docs/browser-sdk-reference.md', 'index.ts']);
    expect(exitCode).toBe(0);
    expect(envelope.ok).toBe(true);
    expect(envelope.meta.command).toBe('page');
    const fence = envelope.data.claims.find(
      (c: { kind: string; rule?: { type: string } }) =>
        c.kind === 'fence' && c.rule?.type === 'prose-deprecated-reference',
    );
    expect(fence).toBeDefined();
    expect(fence.specRef.member).toBe('runSnippet');
    expect(fence.specRef.replacement).toBe('execute');
    expect(fence.candidate).toBe(false);
  });

  test('sdk heading candidate + execute gap; exit 0', () => {
    const { envelope, exitCode } = json(['page', 'docs/sdk-reference.md', 'index.ts']);
    expect(exitCode).toBe(0);
    expect(envelope.ok).toBe(true);
    const heading = envelope.data.claims.find(
      (c: { kind: string; text: string }) => c.kind === 'heading' && c.text === 'runSnippet',
    );
    expect(heading.candidate).toBe(true);
    expect(heading.rule).toBeUndefined();
    const gap = envelope.data.claims.find(
      (c: { kind: string; rule?: { type: string } }) =>
        c.kind === 'gap' && c.rule?.type === 'spec-not-in-claims',
    );
    expect(gap.text).toBe('execute');
    expect(gap.specRef.export).toBe('Simnet');
  });

  test('missing file exits 2', () => {
    const { envelope, exitCode } = json(['page', 'docs/missing.md', 'index.ts']);
    expect(exitCode).toBe(2);
    expect(envelope.ok).toBe(false);
  });

  test('packageName is nearest package.json, not the src folder; path is repo-relative', () => {
    const nest = path.join(TMP, 'monorepo');
    const pkg = path.join(nest, 'packages/sdk');
    mkdirSync(path.join(pkg, 'src'), { recursive: true });
    mkdirSync(path.join(nest, 'docs'), { recursive: true });
    mkdirSync(path.join(nest, '.git'));
    writeFileSync(
      path.join(nest, 'package.json'),
      JSON.stringify({ name: 'monorepo', private: true }),
    );
    writeFileSync(
      path.join(pkg, 'package.json'),
      JSON.stringify({ name: '@acme/sdk', version: '1.0.0' }),
    );
    writeFileSync(
      path.join(pkg, 'src/index.ts'),
      'export class Client { connect() {} disconnect() {} }\n',
    );
    writeFileSync(
      path.join(nest, 'docs/guide.md'),
      '# Client\n\n```ts\nconst c = new Client();\nc.connect();\n```\n',
    );

    const result = run(['page', '../../docs/guide.md', 'src/index.ts', '--json'], pkg);
    const envelope = JSON.parse(result.stdout.toString());
    expect(result.exitCode).toBe(0);
    expect(envelope.data.packageName).toBe('@acme/sdk');
    expect(envelope.data.path).toBe('docs/guide.md');
  });
});
