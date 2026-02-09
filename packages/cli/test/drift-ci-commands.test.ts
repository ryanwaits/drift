import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { getProjectDir } from '../src/config/global';
import { readHistory } from '../src/utils/history';
import { sparkline } from '../src/utils/sparkline';

const HISTORY_FIXTURE = path.resolve(__dirname, 'fixtures/history');
const HISTORY_PROJECT_DIR = getProjectDir(HISTORY_FIXTURE);

// --- Sparkline unit tests ---

describe('sparkline', () => {
  test('renders bars for increasing values', () => {
    const result = sparkline([0, 25, 50, 75, 100]);
    expect(result.length).toBe(5);
    expect(result[0]).toBe('▁');
    expect(result[4]).toBe('█');
  });

  test('empty values → empty string', () => {
    expect(sparkline([])).toBe('');
  });

  test('constant values → all same bar', () => {
    const result = sparkline([50, 50, 50]);
    expect(result[0]).toBe(result[1]);
    expect(result[1]).toBe(result[2]);
  });
});

// --- History unit tests ---

describe('history', () => {
  beforeAll(() => {
    // readHistory now looks in ~/.drift/projects/<slug>/ — copy fixture there
    mkdirSync(HISTORY_PROJECT_DIR, { recursive: true });
    copyFileSync(
      path.join(HISTORY_FIXTURE, '.drift', 'history.jsonl'),
      path.join(HISTORY_PROJECT_DIR, 'history.jsonl'),
    );
  });

  afterAll(() => {
    if (existsSync(HISTORY_PROJECT_DIR)) rmSync(HISTORY_PROJECT_DIR, { recursive: true });
  });

  test('readHistory from fixture', () => {
    const entries = readHistory(HISTORY_FIXTURE);
    expect(entries.length).toBe(13);
    expect(entries[0].package).toBe('@acme/core');
    expect(entries[0].coverage).toBe(38);
  });

  test('readHistory empty dir → empty array', () => {
    const entries = readHistory('/tmp/nonexistent-drift-test');
    expect(entries).toEqual([]);
  });
});
