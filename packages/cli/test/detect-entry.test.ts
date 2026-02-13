import { describe, expect, test } from 'bun:test';
import * as path from 'node:path';
import { detectEntry } from '../src/utils/detect-entry';

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('detectEntry', () => {
  test('dist/src/ layout resolves to src/index.ts, not dist/src/index.js', () => {
    const cwd = path.join(FIXTURES, 'dist-src-layout');
    const entry = detectEntry(cwd);
    expect(entry).toBe(path.join(cwd, 'src/index.ts'));
    // Must NOT resolve to the .js file in dist/
    expect(entry.endsWith('src/index.ts')).toBe(true);
    expect(entry).not.toContain('dist/src/index.js');
  });

  test('standard dist/ layout resolves to src/index.ts', () => {
    const cwd = path.join(FIXTURES, 'sample');
    const entry = detectEntry(cwd);
    expect(entry).toContain('src/index.ts');
    expect(entry).not.toContain('dist/src');
  });

  test('bin-based CLI layout resolves dist/drift.js to src/drift.ts', () => {
    const cwd = path.join(FIXTURES, 'cli-bin-layout');
    const entry = detectEntry(cwd);
    expect(entry).toBe(path.join(cwd, 'src/drift.ts'));
  });
});
