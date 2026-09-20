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
      '## empty-session',
      '',
      '```ts',
      'simnet.runSnippet("(+ 1 2)")',
      '```',
      '',
    ].join('\n'),
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
});
