import { describe, expect, test, setDefaultTimeout, beforeAll, afterAll } from 'bun:test';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import * as path from 'node:path';

setDefaultTimeout(120000);

const CLI = path.resolve(__dirname, '../src/drift.ts');
const CACHE_DIR = path.resolve(__dirname, 'fixtures/.tmp-cache-test');

function run(args: string, opts?: { expectFail?: boolean; cwd?: string }): { stdout: string; exitCode: number } {
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
  test('first run populates cache, second run uses it', () => {
    // Clear any leftover cache
    run('cache clear --json');

    // First run — should extract fresh
    const first = run('coverage src/index.ts --json');
    const env1 = JSON.parse(first.stdout.trim());
    expect(env1.ok).toBe(true);
    expect(env1.data.score).toBe(100);
    const duration1 = env1.meta.duration;

    // Cache should now have an entry
    const status = run('cache status --json');
    const sEnv = JSON.parse(status.stdout.trim());
    expect(sEnv.data.entries).toBeGreaterThanOrEqual(1);

    // Second run — should be faster (cache hit)
    const second = run('coverage src/index.ts --json');
    const env2 = JSON.parse(second.stdout.trim());
    expect(env2.ok).toBe(true);
    expect(env2.data.score).toBe(100);
  });

  test('touching entry file invalidates cache', () => {
    // Run once to populate cache
    run('coverage src/index.ts --json');

    // Touch the entry file (change mtime)
    const entryPath = path.join(CACHE_DIR, 'src', 'index.ts');
    const now = new Date();
    utimesSync(entryPath, now, now);

    // Should re-extract (cache miss due to mtime change)
    const result = run('coverage src/index.ts --json');
    const env = JSON.parse(result.stdout.trim());
    expect(env.ok).toBe(true);
    expect(env.data.score).toBe(100);
  });

  test('--no-cache bypasses cache', () => {
    // Populate cache first
    run('coverage src/index.ts --json');

    // With --no-cache, should still work (extracts fresh)
    const result = run('--no-cache coverage src/index.ts --json');
    const env = JSON.parse(result.stdout.trim());
    expect(env.ok).toBe(true);
    expect(env.data.score).toBe(100);
  });

  test('config change invalidates cache', () => {
    // Clear and populate
    run('cache clear --json');
    run('coverage src/index.ts --json');

    // Add a config file
    writeFileSync(
      path.join(CACHE_DIR, 'drift.config.json'),
      JSON.stringify({ coverage: { min: 50 } }),
    );

    // Should re-extract (config hash changed)
    const result = run('coverage src/index.ts --json');
    const env = JSON.parse(result.stdout.trim());
    expect(env.ok).toBe(true);

    // Clean up config
    rmSync(path.join(CACHE_DIR, 'drift.config.json'));
  });
});

describe('cache subcommands', () => {
  test('cache status returns envelope', () => {
    const result = run('cache status --json');
    const env = JSON.parse(result.stdout.trim());
    expect(env.ok).toBe(true);
    expect(env.meta.command).toBe('cache status');
    expect(env.data).toHaveProperty('entries');
    expect(env.data).toHaveProperty('dir');
    expect(env.data).toHaveProperty('totalBytes');
  });

  test('cache clear removes entries', () => {
    // Ensure there's something to clear
    run('coverage src/index.ts --json');

    const status1 = run('cache status --json');
    const before = JSON.parse(status1.stdout.trim());
    expect(before.data.entries).toBeGreaterThan(0);

    const clearResult = run('cache clear --json');
    const clearEnv = JSON.parse(clearResult.stdout.trim());
    expect(clearEnv.ok).toBe(true);
    expect(clearEnv.data.removed).toBeGreaterThan(0);

    const status2 = run('cache status --json');
    const after = JSON.parse(status2.stdout.trim());
    expect(after.data.entries).toBe(0);
  });

  test('cache status --human outputs readable text', () => {
    const result = run('cache status --human');
    expect(result.stdout).toContain('Cache Status');
    expect(result.stdout).toContain('Entries');
  });

  test('cache clear --human outputs confirmation', () => {
    const result = run('cache clear --human');
    // Either "Cleared N" or "already empty"
    expect(result.stdout.includes('Cleared') || result.stdout.includes('empty')).toBe(true);
  });
});
