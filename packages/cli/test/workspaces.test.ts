import { describe, expect, test } from 'bun:test';
import * as path from 'node:path';
import { discoverPackages, filterPublic } from '../src/utils/workspaces';

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('discoverPackages', () => {
  test('populates private field for private packages', () => {
    const packages = discoverPackages(path.join(FIXTURES, 'monorepo'));
    expect(packages).not.toBeNull();

    const gamma = packages!.find((p) => p.name === '@fixture/gamma');
    expect(gamma).toBeDefined();
    expect(gamma!.private).toBe(true);

    const alpha = packages!.find((p) => p.name === '@fixture/alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.private).toBeUndefined();
  });
});

describe('filterPublic', () => {
  test('removes private packages', () => {
    const packages = discoverPackages(path.join(FIXTURES, 'monorepo'));
    expect(packages).not.toBeNull();

    const filtered = filterPublic(packages!);
    expect(filtered.some((p) => p.name === '@fixture/gamma')).toBe(false);
    expect(filtered.some((p) => p.name === '@fixture/alpha')).toBe(true);
    expect(filtered.some((p) => p.name === '@fixture/beta')).toBe(true);
    expect(filtered.length).toBe(packages!.length - 1);
  });
});
