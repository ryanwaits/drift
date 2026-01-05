/**
 * Tests for spec cache validation and invalidation.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CACHE_VERSION,
  type CacheContext,
  clearSpecCache,
  loadSpecCache,
  type SpecCache,
  saveSpecCache,
  validateSpecCache,
} from '../src/cache/spec-cache';
import { createSpec } from './test-helpers';

describe('validateSpecCache', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-cache-test-'));
    // Create minimal test files
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name":"test"}');
    fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export const x = 1;');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createCache(overrides: Partial<SpecCache> = {}): SpecCache {
    return {
      cacheVersion: CACHE_VERSION,
      generatedAt: new Date().toISOString(),
      specVersion: '0.9.0',
      entryFile: 'index.ts',
      hashes: {
        tsconfig: 'abc123',
        packageJson: 'def456',
        sourceFiles: { 'index.ts': 'ghi789' },
      },
      config: { resolveExternalTypes: false },
      spec: createSpec(),
      ...overrides,
    };
  }

  function createContext(overrides: Partial<CacheContext> = {}): CacheContext {
    return {
      entryFile: path.join(tempDir, 'index.ts'),
      sourceFiles: [path.join(tempDir, 'index.ts')],
      tsconfigPath: path.join(tempDir, 'tsconfig.json'),
      packageJsonPath: path.join(tempDir, 'package.json'),
      config: { resolveExternalTypes: false },
      cwd: tempDir,
      ...overrides,
    };
  }

  describe('cache version check', () => {
    test('invalidates on version mismatch', () => {
      const cache = createCache({ cacheVersion: '0.0.1' });
      const context = createContext();

      const result = validateSpecCache(cache, context);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('cache-version-mismatch');
    });

    test('passes with matching version', () => {
      // First save a valid cache
      const spec = createSpec();
      const context = createContext();
      saveSpecCache(spec, context);

      // Load and validate
      const cache = loadSpecCache(tempDir);
      expect(cache).not.toBeNull();

      const result = validateSpecCache(cache!, context);
      expect(result.valid).toBe(true);
    });
  });

  describe('entry file check', () => {
    test('invalidates when entry file changes', () => {
      const cache = createCache({ entryFile: 'other.ts' });
      const context = createContext();

      const result = validateSpecCache(cache, context);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('entry-file-changed');
    });
  });

  describe('config check', () => {
    test('invalidates when resolveExternalTypes changes', () => {
      const spec = createSpec();
      const context = createContext({ config: { resolveExternalTypes: false } });
      saveSpecCache(spec, context);

      const cache = loadSpecCache(tempDir)!;
      const newContext = createContext({ config: { resolveExternalTypes: true } });

      const result = validateSpecCache(cache, newContext);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('config-changed');
    });
  });

  describe('tsconfig check', () => {
    test('invalidates when tsconfig changes', () => {
      const spec = createSpec();
      const context = createContext();
      saveSpecCache(spec, context);

      // Modify tsconfig
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{"strict": true}');

      const cache = loadSpecCache(tempDir)!;
      const result = validateSpecCache(cache, context);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('tsconfig-changed');
    });

    test('handles missing tsconfig', () => {
      const spec = createSpec();
      const context = createContext({ tsconfigPath: null });
      saveSpecCache(spec, context);

      const cache = loadSpecCache(tempDir)!;
      const result = validateSpecCache(cache, context);

      expect(result.valid).toBe(true);
    });

    test('invalidates when tsconfig removed', () => {
      const spec = createSpec();
      const context = createContext();
      saveSpecCache(spec, context);

      // Remove tsconfig
      fs.unlinkSync(path.join(tempDir, 'tsconfig.json'));

      const cache = loadSpecCache(tempDir)!;
      const newContext = createContext({ tsconfigPath: null });

      const result = validateSpecCache(cache, newContext);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('tsconfig-changed');
    });
  });

  describe('package.json check', () => {
    test('invalidates when package.json changes', () => {
      const spec = createSpec();
      const context = createContext();
      saveSpecCache(spec, context);

      // Modify package.json
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name":"modified"}');

      const cache = loadSpecCache(tempDir)!;
      const result = validateSpecCache(cache, context);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('package-json-changed');
    });
  });

  describe('source files check', () => {
    test('invalidates when source file changes', () => {
      const spec = createSpec();
      const context = createContext();
      saveSpecCache(spec, context);

      // Modify source file
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export const y = 2;');

      const cache = loadSpecCache(tempDir)!;
      const result = validateSpecCache(cache, context);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('source-files-changed');
      expect(result.changedFiles).toContain('index.ts');
    });

    test('invalidates when source file added', () => {
      const spec = createSpec();
      const context = createContext();
      saveSpecCache(spec, context);

      // Add new source file
      const newFile = path.join(tempDir, 'utils.ts');
      fs.writeFileSync(newFile, 'export const helper = () => {};');

      const cache = loadSpecCache(tempDir)!;
      const newContext = createContext({
        sourceFiles: [path.join(tempDir, 'index.ts'), newFile],
      });

      const result = validateSpecCache(cache, newContext);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('source-files-changed');
      expect(result.changedFiles).toContain('utils.ts');
    });

    test('invalidates when source file removed', () => {
      // Create initial state with two files
      const utilsPath = path.join(tempDir, 'utils.ts');
      fs.writeFileSync(utilsPath, 'export const helper = () => {};');

      const spec = createSpec();
      const context = createContext({
        sourceFiles: [path.join(tempDir, 'index.ts'), utilsPath],
      });
      saveSpecCache(spec, context);

      // Now validate with one file removed from context
      const cache = loadSpecCache(tempDir)!;
      const newContext = createContext({
        sourceFiles: [path.join(tempDir, 'index.ts')],
      });

      const result = validateSpecCache(cache, newContext);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('source-files-changed');
    });
  });
});

describe('saveSpecCache / loadSpecCache', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-cache-test-'));
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name":"test"}');
    fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export const x = 1;');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('round-trips spec through cache', () => {
    const spec = createSpec({ name: 'my-pkg', version: '2.0.0' });
    const context: CacheContext = {
      entryFile: path.join(tempDir, 'index.ts'),
      sourceFiles: [path.join(tempDir, 'index.ts')],
      tsconfigPath: path.join(tempDir, 'tsconfig.json'),
      packageJsonPath: path.join(tempDir, 'package.json'),
      config: { resolveExternalTypes: false },
      cwd: tempDir,
    };

    saveSpecCache(spec, context);
    const loaded = loadSpecCache(tempDir);

    expect(loaded).not.toBeNull();
    expect(loaded!.spec.name).toBe('my-pkg');
    expect(loaded!.spec.version).toBe('2.0.0');
  });

  test('creates cache directory if missing', () => {
    const spec = createSpec();
    const context: CacheContext = {
      entryFile: path.join(tempDir, 'index.ts'),
      sourceFiles: [path.join(tempDir, 'index.ts')],
      tsconfigPath: path.join(tempDir, 'tsconfig.json'),
      packageJsonPath: path.join(tempDir, 'package.json'),
      config: { resolveExternalTypes: false },
      cwd: tempDir,
    };

    saveSpecCache(spec, context);

    expect(fs.existsSync(path.join(tempDir, '.doccov', 'cache'))).toBe(true);
  });

  test('returns null for missing cache', () => {
    const loaded = loadSpecCache(tempDir);
    expect(loaded).toBeNull();
  });

  test('returns null for invalid JSON', () => {
    const cacheDir = path.join(tempDir, '.doccov', 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'spec.cache.json'), 'not valid json');

    const loaded = loadSpecCache(tempDir);
    expect(loaded).toBeNull();
  });
});

describe('clearSpecCache', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-cache-test-'));
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name":"test"}');
    fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export const x = 1;');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('returns true when cache exists', () => {
    const spec = createSpec();
    const context: CacheContext = {
      entryFile: path.join(tempDir, 'index.ts'),
      sourceFiles: [path.join(tempDir, 'index.ts')],
      tsconfigPath: path.join(tempDir, 'tsconfig.json'),
      packageJsonPath: path.join(tempDir, 'package.json'),
      config: { resolveExternalTypes: false },
      cwd: tempDir,
    };

    saveSpecCache(spec, context);
    const cleared = clearSpecCache(tempDir);

    expect(cleared).toBe(true);
    expect(loadSpecCache(tempDir)).toBeNull();
  });

  test('returns false when cache does not exist', () => {
    const cleared = clearSpecCache(tempDir);
    expect(cleared).toBe(false);
  });
});
