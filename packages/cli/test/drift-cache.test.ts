import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

setDefaultTimeout(120000);

const CLI = path.resolve(__dirname, '../src/drift.ts');
const CACHE_DIR = path.resolve(__dirname, 'fixtures/.tmp-cache-test');

function run(
  args: string,
  opts?: { expectFail?: boolean; cwd?: string },
): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`bun run ${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: opts?.cwd ?? CACHE_DIR,
    });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    if (opts?.expectFail) {
      return { stdout: e.stdout ?? '', exitCode: e.status ?? 1 };
    }
    throw err;
  }
}

beforeAll(() => {
  mkdirSync(path.join(CACHE_DIR, 'src'), { recursive: true });
  writeFileSync(
    path.join(CACHE_DIR, 'package.json'),
    JSON.stringify({ name: 'cache-test-pkg', version: '1.0.0' }),
  );
  writeFileSync(
    path.join(CACHE_DIR, 'src', 'index.ts'),
    `/** Add two numbers. */\nexport function add(a: number, b: number): number { return a + b; }\n/** Greet. */\nexport function hello(name: string): string { return 'hi ' + name; }\n`,
  );
});

afterAll(() => {
  if (existsSync(CACHE_DIR)) rmSync(CACHE_DIR, { recursive: true });
});

describe('spec cache', () => {
  test('scan works twice (cache hit or miss both succeed)', () => {
    const first = run('scan src/index.ts --json');
    const env1 = JSON.parse(first.stdout.trim());
    expect(env1.ok).toBe(true);
    expect(env1.data.coverage.score).toBe(100);

    const second = run('scan src/index.ts --json');
    const env2 = JSON.parse(second.stdout.trim());
    expect(env2.ok).toBe(true);
    expect(env2.data.coverage.score).toBe(100);
  });

  test('touching entry file still scans', () => {
    run('scan src/index.ts --json');
    const entryPath = path.join(CACHE_DIR, 'src', 'index.ts');
    const now = new Date();
    utimesSync(entryPath, now, now);

    const result = run('scan src/index.ts --json');
    const env = JSON.parse(result.stdout.trim());
    expect(env.ok).toBe(true);
    expect(env.data.coverage.score).toBe(100);
  });

  test('--no-cache bypasses cache', () => {
    run('scan src/index.ts --json');
    const result = run('--no-cache scan src/index.ts --json');
    const env = JSON.parse(result.stdout.trim());
    expect(env.ok).toBe(true);
    expect(env.data.coverage.score).toBe(100);
  });

  test('config change still scans', () => {
    run('scan src/index.ts --json');
    writeFileSync(
      path.join(CACHE_DIR, 'drift.config.json'),
      JSON.stringify({ coverage: { min: 50 } }),
    );
    const result = run('scan src/index.ts --json');
    const env = JSON.parse(result.stdout.trim());
    expect(env.ok).toBe(true);
    rmSync(path.join(CACHE_DIR, 'drift.config.json'));
  });
});
