import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  cleanupOrphanedTempFiles,
  findOrphanedTempFiles,
  IncrementalAnalyzer,
} from '../src/analysis/incremental';

describe('IncrementalAnalyzer', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-test-'));
  });

  afterEach(() => {
    // Clean up test temp dir
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('creates temp file on first write', async () => {
    const analyzer = new IncrementalAnalyzer({ tempDir, prefix: 'test' });

    expect(analyzer.exists()).toBe(false);

    await analyzer.writeResult({
      id: 'test1',
      name: 'test1',
      coverageScore: 80,
      timestamp: Date.now(),
    });

    expect(analyzer.exists()).toBe(true);
    expect(analyzer.count).toBe(1);

    await analyzer.cleanup();
  });

  test('writes multiple results', async () => {
    const analyzer = new IncrementalAnalyzer({ tempDir, prefix: 'test' });
    analyzer.setTotal(3);

    await analyzer.writeResult({
      id: 'export1',
      name: 'export1',
      coverageScore: 90,
      timestamp: Date.now(),
    });
    await analyzer.writeResult({
      id: 'export2',
      name: 'export2',
      coverageScore: 70,
      missing: ['description', 'examples'],
      timestamp: Date.now(),
    });
    await analyzer.writeResult({
      id: 'export3',
      name: 'export3',
      coverageScore: 100,
      timestamp: Date.now(),
    });

    expect(analyzer.count).toBe(3);

    const partial = await analyzer.getPartialResults();
    expect(partial.results).toHaveLength(3);
    expect(partial.totalExpected).toBe(3);
    expect(partial.interrupted).toBe(false);

    expect(partial.results[0].name).toBe('export1');
    expect(partial.results[0].coverageScore).toBe(90);
    expect(partial.results[1].missing).toEqual(['description', 'examples']);

    await analyzer.cleanup();
  });

  test('writeExportAnalysis converts ExportAnalysis format', async () => {
    const analyzer = new IncrementalAnalyzer({ tempDir, prefix: 'test' });

    await analyzer.writeExportAnalysis('myFunc', 'myFunc', {
      coverageScore: 75,
      missing: ['params', 'returns'],
      drift: [
        {
          type: 'missing-param-doc',
          target: 'options',
          issue: 'Missing docs for param',
          category: 'structural',
        },
      ],
    });

    const partial = await analyzer.getPartialResults();
    expect(partial.results).toHaveLength(1);
    expect(partial.results[0].id).toBe('myFunc');
    expect(partial.results[0].coverageScore).toBe(75);
    expect(partial.results[0].missing).toEqual(['params', 'returns']);
    expect(partial.results[0].drift).toHaveLength(1);

    await analyzer.cleanup();
  });

  test('detects interrupted analysis', async () => {
    const analyzer = new IncrementalAnalyzer({ tempDir, prefix: 'test' });
    analyzer.setTotal(5);

    // Only write 2 of 5 expected
    await analyzer.writeResult({
      id: 'export1',
      name: 'export1',
      coverageScore: 80,
      timestamp: Date.now(),
    });
    await analyzer.writeResult({
      id: 'export2',
      name: 'export2',
      coverageScore: 90,
      timestamp: Date.now(),
    });

    const partial = await analyzer.getPartialResults();
    expect(partial.results).toHaveLength(2);
    expect(partial.totalExpected).toBe(5);
    expect(partial.interrupted).toBe(true);

    await analyzer.cleanup();
  });

  test('handles empty/nonexistent file', async () => {
    const analyzer = new IncrementalAnalyzer({ tempDir, prefix: 'test' });

    const partial = await analyzer.getPartialResults();
    expect(partial.results).toHaveLength(0);
    expect(partial.interrupted).toBe(false);
  });

  test('cleanup removes temp file', async () => {
    const analyzer = new IncrementalAnalyzer({ tempDir, prefix: 'test' });

    await analyzer.writeResult({
      id: 'test',
      name: 'test',
      coverageScore: 100,
      timestamp: Date.now(),
    });

    expect(analyzer.exists()).toBe(true);

    await analyzer.cleanup();

    expect(analyzer.exists()).toBe(false);
  });

  test('cleanupSync removes temp file synchronously', async () => {
    const analyzer = new IncrementalAnalyzer({ tempDir, prefix: 'test' });

    await analyzer.writeResult({
      id: 'test',
      name: 'test',
      coverageScore: 100,
      timestamp: Date.now(),
    });

    expect(analyzer.exists()).toBe(true);

    analyzer.cleanupSync();

    expect(analyzer.exists()).toBe(false);
  });

  test('getPartialResultsSync reads results synchronously', async () => {
    const analyzer = new IncrementalAnalyzer({ tempDir, prefix: 'test' });
    analyzer.setTotal(2);

    await analyzer.writeResult({
      id: 'sync1',
      name: 'sync1',
      coverageScore: 85,
      timestamp: Date.now(),
    });
    await analyzer.writeResult({
      id: 'sync2',
      name: 'sync2',
      coverageScore: 95,
      timestamp: Date.now(),
    });

    // Close handle so sync read works
    const partial = analyzer.getPartialResultsSync();
    expect(partial.results).toHaveLength(2);
    expect(partial.results[0].name).toBe('sync1');
    expect(partial.results[1].name).toBe('sync2');

    analyzer.cleanupSync();
  });

  test('handles malformed JSON lines gracefully', async () => {
    const analyzer = new IncrementalAnalyzer({ tempDir, prefix: 'test' });
    await analyzer.init();

    // Write a valid result
    await analyzer.writeResult({
      id: 'valid',
      name: 'valid',
      coverageScore: 80,
      timestamp: Date.now(),
    });

    // Manually append malformed line (simulating partial write on crash)
    const filePath = analyzer.path;
    fs.appendFileSync(filePath, '{"type":"result","id":"partial","name":"par\n');

    const partial = await analyzer.getPartialResults();
    // Should skip malformed line
    expect(partial.results).toHaveLength(1);
    expect(partial.results[0].name).toBe('valid');

    await analyzer.cleanup();
  });
});

describe('orphaned temp file utilities', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-orphan-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('findOrphanedTempFiles finds matching files', () => {
    // Create some test files
    fs.writeFileSync(path.join(tempDir, 'drift-123.ndjson'), '');
    fs.writeFileSync(path.join(tempDir, 'drift-456.ndjson'), '');
    fs.writeFileSync(path.join(tempDir, 'other-file.txt'), '');

    const files = findOrphanedTempFiles(tempDir, 'drift');
    expect(files).toHaveLength(2);
    expect(files.every((f) => f.includes('drift'))).toBe(true);
  });

  test('cleanupOrphanedTempFiles removes old files', async () => {
    // Create files with different ages
    const oldFile = path.join(tempDir, 'drift-old.ndjson');
    const newFile = path.join(tempDir, 'drift-new.ndjson');

    fs.writeFileSync(oldFile, '');
    fs.writeFileSync(newFile, '');

    // Set old file's mtime to 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, twoHoursAgo, twoHoursAgo);

    // Clean up files older than 1 hour
    const cleaned = cleanupOrphanedTempFiles(tempDir, 'drift', 60 * 60 * 1000);

    expect(cleaned).toBe(1);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
  });

  test('cleanupOrphanedTempFiles handles empty directory', () => {
    const cleaned = cleanupOrphanedTempFiles(tempDir, 'drift');
    expect(cleaned).toBe(0);
  });
});
