/**
 * Tests for entry point detection utilities.
 */
import { describe, expect, test } from 'bun:test';
import { type FileSystem, findEntryPointForFile, isPackageEntryPoint } from '../src/detect';

/**
 * Create a mock filesystem for testing.
 */
function createMockFs(files: Record<string, string>): FileSystem {
  return {
    exists: async (path: string) => path in files,
    readFile: async (path: string) => {
      if (path in files) return files[path];
      throw new Error(`File not found: ${path}`);
    },
    readDir: async (path: string) => {
      const prefix = path.endsWith('/') ? path : `${path}/`;
      const entries = new Set<string>();
      for (const filePath of Object.keys(files)) {
        if (filePath.startsWith(prefix)) {
          const rest = filePath.slice(prefix.length);
          const firstPart = rest.split('/')[0];
          if (firstPart) entries.add(firstPart);
        }
      }
      return Array.from(entries);
    },
    isDirectory: async (path: string) => {
      const prefix = path.endsWith('/') ? path : `${path}/`;
      return Object.keys(files).some((f) => f.startsWith(prefix));
    },
  };
}

describe('findEntryPointForFile', () => {
  test('finds entry point for file in package', async () => {
    const fs = createMockFs({
      '/project/package.json': JSON.stringify({
        name: 'my-package',
        types: './dist/index.d.ts',
      }),
      '/project/src/index.ts': 'export * from "./utils";',
      '/project/src/utils.ts': 'export const util = 1;',
    });

    const result = await findEntryPointForFile(fs, '/project/src/utils.ts');

    expect(result).not.toBeNull();
    expect(result?.packagePath).toBe('/project');
    expect(result?.entryPoint.path).toBe('src/index.ts');
  });

  test('returns null when no package.json found', async () => {
    const fs = createMockFs({
      '/project/src/utils.ts': 'export const util = 1;',
    });

    const result = await findEntryPointForFile(fs, '/project/src/utils.ts');

    expect(result).toBeNull();
  });

  test('walks up directories to find package.json', async () => {
    const fs = createMockFs({
      '/project/package.json': JSON.stringify({
        name: 'my-package',
        types: './dist/index.d.ts',
      }),
      '/project/src/index.ts': 'export {};',
      '/project/src/deep/nested/file.ts': 'export const x = 1;',
    });

    const result = await findEntryPointForFile(fs, '/project/src/deep/nested/file.ts');

    expect(result).not.toBeNull();
    expect(result?.packagePath).toBe('/project');
  });
});

describe('isPackageEntryPoint', () => {
  test('returns true for the package entry point', async () => {
    const fs = createMockFs({
      '/project/package.json': JSON.stringify({
        name: 'my-package',
        types: './dist/index.d.ts',
      }),
      '/project/src/index.ts': 'export {};',
    });

    const result = await isPackageEntryPoint(fs, '/project/src/index.ts');

    expect(result).toBe(true);
  });

  test('returns false for non-entry point files', async () => {
    const fs = createMockFs({
      '/project/package.json': JSON.stringify({
        name: 'my-package',
        types: './dist/index.d.ts',
      }),
      '/project/src/index.ts': 'export {};',
      '/project/src/utils.ts': 'export const x = 1;',
    });

    const result = await isPackageEntryPoint(fs, '/project/src/utils.ts');

    expect(result).toBe(false);
  });

  test('returns false when no package found', async () => {
    const fs = createMockFs({
      '/project/src/utils.ts': 'export const x = 1;',
    });

    const result = await isPackageEntryPoint(fs, '/project/src/utils.ts');

    expect(result).toBe(false);
  });
});
