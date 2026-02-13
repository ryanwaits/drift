import { describe, expect, setDefaultTimeout, test } from 'bun:test';
import { readFileSync } from 'node:fs';

setDefaultTimeout(30000);

import * as path from 'node:path';
import { computeDrift } from '@driftdev/sdk';
import { extract, filterSpec, getExport, listExports } from '@openpkg-ts/sdk';
import {
  categorizeBreakingChanges,
  diffSpec,
  normalize,
  recommendSemverBump,
  validateSpec,
} from '@openpkg-ts/spec';

const FIXTURE = path.resolve(__dirname, 'fixtures/sample/src/index.ts');
const CLEAN = path.resolve(__dirname, 'fixtures/clean/src/index.ts');
const ISSUES = path.resolve(__dirname, 'fixtures/issues/src/index.ts');
const OLD_SPEC = path.resolve(__dirname, 'fixtures/diff/old.json');
const NEW_SPEC = path.resolve(__dirname, 'fixtures/diff/new.json');

function loadSpec(p: string) {
  return JSON.parse(readFileSync(p, 'utf-8'));
}

describe('drift commands integration', () => {
  test('list returns all exports with correct kinds', async () => {
    const result = await listExports({ entryFile: FIXTURE });

    expect(result.exports.length).toBe(9);
    const names = result.exports.map((e) => e.name).sort();
    expect(names).toEqual([
      'ApiClient',
      'ClientConfig',
      'JobStatus',
      'MAX_RETRIES',
      'User',
      'add',
      'fetchUser',
      'getUser',
      'undocumented',
    ]);

    // Check kinds
    const byName = Object.fromEntries(result.exports.map((e) => [e.name, e.kind]));
    expect(byName.fetchUser).toBe('function');
    expect(byName.ApiClient).toBe('class');
    expect(byName.User).toBe('interface');
    expect(byName.JobStatus).toBe('type');
    expect(byName.MAX_RETRIES).toBe('variable');

    // Check deprecated
    const deprecated = result.exports.filter((e) => e.deprecated);
    expect(deprecated.length).toBe(1);
    expect(deprecated[0].name).toBe('getUser');
  });

  test('get returns export detail with types', async () => {
    const result = await getExport({ entryFile: FIXTURE, exportName: 'fetchUser' });

    expect(result.export).not.toBeNull();
    expect(result.export!.name).toBe('fetchUser');
    expect(result.export!.kind).toBe('function');
    expect(result.export!.signatures?.length).toBeGreaterThan(0);
    expect(result.export!.signatures![0].parameters?.length).toBe(1);
    expect(result.export!.signatures![0].parameters![0].name).toBe('id');

    // Should have User type
    expect(result.types.length).toBeGreaterThan(0);
  });

  test('get returns null for missing export', async () => {
    const result = await getExport({ entryFile: FIXTURE, exportName: 'doesNotExist' });
    expect(result.export).toBeNull();
  });

  test('extract → validate round-trip', async () => {
    const extracted = await extract({ entryFile: FIXTURE });
    const spec = normalize(extracted.spec);
    const validation = validateSpec(spec);

    expect(validation.ok).toBe(true);
  });

  test('extract → filter by kind', async () => {
    const extracted = await extract({ entryFile: FIXTURE });
    const spec = normalize(extracted.spec);

    const functions = filterSpec(spec, { kinds: ['function'] });
    expect(functions.matched).toBe(4);
    expect(functions.total).toBe(9);
    expect(functions.spec.exports.every((e) => e.kind === 'function')).toBe(true);

    const interfaces = filterSpec(spec, { kinds: ['interface'] });
    expect(interfaces.matched).toBe(2);
  });

  test('extract → filter by search', async () => {
    const extracted = await extract({ entryFile: FIXTURE });
    const spec = normalize(extracted.spec);

    const result = filterSpec(spec, { search: 'user' });
    expect(result.matched).toBeGreaterThan(0);
    const names = result.spec.exports.map((e) => e.name);
    expect(names).toContain('fetchUser');
    expect(names).toContain('User');
  });

  test('list → get round-trip (names match)', async () => {
    const listed = await listExports({ entryFile: FIXTURE });
    const firstName = listed.exports[0].name;

    const detail = await getExport({ entryFile: FIXTURE, exportName: firstName });
    expect(detail.export).not.toBeNull();
    expect(detail.export!.name).toBe(firstName);
  });

  // Coverage tests
  test('coverage: clean fixture = 100%', async () => {
    const result = await extract({ entryFile: CLEAN });
    const spec = normalize(result.spec);
    const exports = spec.exports ?? [];
    const undocumented = exports.filter((e) => !e.description?.trim());

    expect(exports.length).toBe(4);
    expect(undocumented.length).toBe(0);
  });

  test('coverage: issues fixture has undocumented exports', async () => {
    const result = await extract({ entryFile: ISSUES });
    const spec = normalize(result.spec);
    const exports = spec.exports ?? [];
    const undocumented = exports.filter((e) => !e.description?.trim()).map((e) => e.name);

    expect(exports.length).toBe(8);
    expect(undocumented).toContain('undocOne');
    expect(undocumented).toContain('undocTwo');
    expect(undocumented).toContain('MAGIC_NUMBER');
    expect(undocumented.length).toBe(3);

    const score = Math.round(((exports.length - undocumented.length) / exports.length) * 100);
    expect(score).toBe(63);
  });

  // Lint tests
  test('lint: clean fixture = no issues', async () => {
    const result = await extract({ entryFile: CLEAN });
    const spec = normalize(result.spec);
    const driftResult = computeDrift(spec);

    let issueCount = 0;
    for (const [, drifts] of driftResult.exports) {
      issueCount += drifts.length;
    }
    expect(issueCount).toBe(0);
  });

  test('lint: issues fixture detects param/link problems', async () => {
    const result = await extract({ entryFile: ISSUES });
    const spec = normalize(result.spec);
    const driftResult = computeDrift(spec);

    const issues: { export: string; issue: string }[] = [];
    for (const [exportName, drifts] of driftResult.exports) {
      for (const drift of drifts) {
        issues.push({ export: exportName, issue: drift.issue });
      }
    }

    expect(issues.length).toBe(4);

    const exportNames = issues.map((i) => i.export);
    expect(exportNames).toContain('fetchUser');
    expect(exportNames).toContain('sendMessage');
    expect(exportNames).toContain('calculateTotal');
  });

  // Comparison tests
  test('diff: detects breaking, added, changed', () => {
    const oldSpec = loadSpec(OLD_SPEC);
    const newSpec = loadSpec(NEW_SPEC);
    const diff = diffSpec(oldSpec, newSpec);

    expect(diff.breaking).toContain('multiply');
    expect(diff.nonBreaking).toContain('subtract');
    expect(diff.docsOnly).toContain('Point');
  });

  test('breaking: categorizes with severity', () => {
    const oldSpec = loadSpec(OLD_SPEC);
    const newSpec = loadSpec(NEW_SPEC);
    const diff = diffSpec(oldSpec, newSpec);
    const breaking = categorizeBreakingChanges(diff.breaking, oldSpec, newSpec);

    expect(breaking.length).toBe(1);
    expect(breaking[0].name).toBe('multiply');
    expect(breaking[0].severity).toBe('high');
    expect(breaking[0].reason).toBe('removed');
  });

  test('semver: recommends major for breaking changes', () => {
    const oldSpec = loadSpec(OLD_SPEC);
    const newSpec = loadSpec(NEW_SPEC);
    const diff = diffSpec(oldSpec, newSpec);
    const rec = recommendSemverBump(diff);

    expect(rec.bump).toBe('major');
    expect(rec.breakingCount).toBe(1);
  });

  test('semver: recommends minor for additions only', () => {
    // Remove multiply from old spec to make it non-breaking
    const oldSpec = loadSpec(OLD_SPEC);
    const newSpec = loadSpec(NEW_SPEC);
    // Both have add + Point, new has subtract. Remove multiply from old.
    oldSpec.exports = oldSpec.exports.filter((e: { id: string }) => e.id !== 'multiply');
    const diff = diffSpec(oldSpec, newSpec);
    const rec = recommendSemverBump(diff);

    expect(rec.bump).toBe('minor');
  });

  test('diff: identical specs = no changes', () => {
    const spec = loadSpec(OLD_SPEC);
    const diff = diffSpec(spec, spec);

    expect(diff.breaking.length).toBe(0);
    expect(diff.nonBreaking.length).toBe(0);
    expect(diff.docsOnly.length).toBe(0);
  });
});
