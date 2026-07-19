import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const TMP = path.resolve(__dirname, '.tmp-docs-map');
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
  return { envelope: JSON.parse(result.stdout.toString()), exitCode: result.exitCode };
}

beforeAll(() => {
  mkdirSync(path.join(TMP, 'docs'), { recursive: true });
  writeFileSync(
    path.join(TMP, 'package.json'),
    JSON.stringify({ name: 'fixture-pkg', version: '1.0.0' }),
  );
  writeFileSync(
    path.join(TMP, 'index.ts'),
    [
      '/** Client options. */',
      'export interface ClientOptions {',
      '  /** API host */',
      '  host?: string;',
      '  /** Flush interval ms */',
      '  flushInterval?: number;',
      '  /** Not documented on the page */',
      '  missingOption?: boolean;',
      '  /** @deprecated Use `secretKey` instead. */',
      '  personalApiKey?: string;',
      '  /** Replacement credential */',
      '  secretKey?: string;',
      '}',
      'export function createClient(options: ClientOptions): void {}',
    ].join('\n'),
  );
  writeFileSync(
    path.join(TMP, 'docs', 'config.mdx'),
    [
      '# Configuring',
      '',
      '## Configuration options',
      '',
      '| Option | Description |',
      '| --- | --- |',
      '| `host` | API host |',
      '| `flushInterval` | Flush interval |',
      '| `ghostOption` | Does not exist |',
      '| `personalApiKey` | Deprecated credential |',
    ].join('\n'),
  );
  writeFileSync(
    path.join(TMP, 'drift.docs-map.json'),
    JSON.stringify({
      version: 1,
      pages: [{ page: 'docs/config.mdx', type: 'ClientOptions', baselineGaps: 2 }],
    }),
  );
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('drift scan --docs-map', () => {
  test('reports gaps/ghosts/inversions and fails on ghost', () => {
    const { envelope, exitCode } = json(['scan', 'index.ts', '--docs-map', 'drift.docs-map.json']);
    expect(envelope.ok).toBe(true);
    const cov = envelope.data.docsCoverage;
    expect(cov.pass).toBe(false);
    const page = cov.pages[0];
    expect(page.status).toBe('fail');
    expect(page.ghosts.map((g: { key: string }) => g.key)).toEqual(['ghostOption']);
    // Two user-facing gaps (== baseline 2, so no gap failure — only the ghost fails)
    expect(page.gaps.userFacing.map((g: { key: string }) => g.key)).toEqual([
      'missingOption',
      'secretKey',
    ]);
    // inversion auto-derived from the @deprecated JSDoc
    expect(page.inversions).toEqual([
      { documented: 'personalApiKey', replacement: 'secretKey', source: 'spec' },
    ]);
    expect(exitCode).toBe(1);
  });

  test('--annotations emits ::error for ghosts with file locations', () => {
    const result = run([
      'scan',
      'index.ts',
      '--docs-map',
      'drift.docs-map.json',
      '--annotations',
      '--json',
    ]);
    const stdout = result.stdout.toString();
    expect(stdout).toContain('::error ');
    expect(stdout).toContain('ghostOption');
    expect(stdout).toContain('::warning ');
  });

  test('invalid map exits 2 with precise error', () => {
    writeFileSync(
      path.join(TMP, 'bad-map.json'),
      JSON.stringify({ version: 1, pages: [{ page: 'docs/config.mdx' }] }),
    );
    const result = run(['scan', 'index.ts', '--docs-map', 'bad-map.json', '--json']);
    expect(result.exitCode).toBe(2);
    expect(result.stdout.toString()).toContain('pages[0]');
  });
});

describe('drift docs-map', () => {
  test('stub proposes page→type mapping by key overlap', () => {
    const { envelope } = json(['docs-map', 'stub', '--docs', 'docs']);
    expect(envelope.ok).toBe(true);
    const stub = envelope.data.stub;
    expect(stub.pages).toHaveLength(1);
    expect(stub.pages[0].type).toBe('ClientOptions');
    expect(envelope.data.candidates[0].candidates[0].type).toBe('ClientOptions');
  });

  test('baseline tightens but never raises', () => {
    // Baseline 5 > actual 2 gaps → tightens to 2
    writeFileSync(
      path.join(TMP, 'ratchet-map.json'),
      JSON.stringify({
        version: 1,
        pages: [{ page: 'docs/config.mdx', type: 'ClientOptions', baselineGaps: 5 }],
      }),
    );
    const { envelope } = json(['docs-map', 'baseline', 'ratchet-map.json']);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.changes).toEqual([{ page: 'docs/config.mdx', from: 5, to: 2 }]);
    const updated = JSON.parse(readFileSync(path.join(TMP, 'ratchet-map.json'), 'utf-8'));
    expect(updated.pages[0].baselineGaps).toBe(2);

    // Second run: nothing to tighten
    const again = json(['docs-map', 'baseline', 'ratchet-map.json']);
    expect(again.envelope.data.changes).toEqual([]);
  });
});
