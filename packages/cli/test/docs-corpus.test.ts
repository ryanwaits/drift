import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const TMP = path.resolve(__dirname, '.tmp-docs-corpus');

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
  mkdirSync(path.join(TMP, 'external-docs', 'guides'), { recursive: true });
  writeFileSync(
    path.join(TMP, 'package.json'),
    JSON.stringify({ name: 'fixture-pkg', version: '1.0.0' }),
  );
  writeFileSync(
    path.join(TMP, 'index.ts'),
    [
      '/** Adds two numbers. */',
      'export function add(a: number, b: number): number {',
      '  return a + b;',
      '}',
    ].join('\n'),
  );
  // Hosted-docs stand-in: lives OUTSIDE the default discovery patterns
  // (README.md, docs/**, content/**) and references a nonexistent export.
  writeFileSync(
    path.join(TMP, 'external-docs', 'guides', 'usage.md'),
    [
      '# Usage',
      '',
      '```ts',
      "import { add, removedFn } from 'fixture-pkg';",
      '',
      'add(1, 2);',
      'removedFn();',
      '```',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('drift lint --docs', () => {
  test('default discovery does not see the external corpus', () => {
    const result = run(['lint', 'index.ts', '--json']);
    const envelope = JSON.parse(result.stdout.toString());
    expect(envelope.ok).toBe(true);
    const issues = envelope.data.issues as Array<{ issue: string }>;
    expect(issues.some((i) => i.issue.includes('removedFn'))).toBe(false);
  });

  test('--docs <dir> ingests the corpus and flags claims not in spec', () => {
    const result = run(['lint', 'index.ts', '--docs', 'external-docs', '--json']);
    const envelope = JSON.parse(result.stdout.toString());
    expect(envelope.ok).toBe(true);
    const issues = envelope.data.issues as Array<{ issue: string; filePath?: string }>;
    const hit = issues.find((i) => i.issue.includes('removedFn'));
    expect(hit).toBeDefined();
    expect(hit?.filePath).toContain('usage.md');
    expect(result.exitCode).toBe(1);
  });

  test('--docs <glob> works like a directory', () => {
    const result = run(['lint', 'index.ts', '--docs', 'external-docs/**/*.md', '--json']);
    const envelope = JSON.parse(result.stdout.toString());
    const issues = envelope.data.issues as Array<{ issue: string }>;
    expect(issues.some((i) => i.issue.includes('removedFn'))).toBe(true);
  });

  test('--docs matching nothing warns but does not fail', () => {
    const result = run(['lint', 'index.ts', '--docs', 'no-such-dir', '--json']);
    const envelope = JSON.parse(result.stdout.toString());
    expect(envelope.ok).toBe(true);
    expect(result.stderr.toString()).toContain('matched no markdown files');
  });
});

describe('drift scan --docs', () => {
  test('scan picks up prose drift from the external corpus', () => {
    const result = run(['scan', 'index.ts', '--docs', 'external-docs', '--json']);
    const envelope = JSON.parse(result.stdout.toString());
    expect(envelope.ok).toBe(true);
    const issues = envelope.data.lint.issues as Array<{ issue: string }>;
    expect(issues.some((i) => i.issue.includes('removedFn'))).toBe(true);
  });
});
