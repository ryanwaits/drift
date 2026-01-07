/**
 * Standard Schema Runtime Extraction Tests
 *
 * Tests the subprocess-based Standard Schema extraction.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  extractStandardSchemas,
  isStandardJSONSchema,
  resolveCompiledPath,
} from '../src/extract/schema';

describe('isStandardJSONSchema', () => {
  test('returns true for valid StandardJSONSchemaV1 object', () => {
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'zod',
        jsonSchema: {
          input: () => ({ type: 'string' }),
          output: () => ({ type: 'string' }),
        },
      },
    };
    expect(isStandardJSONSchema(schema)).toBe(true);
  });

  test('returns false for missing ~standard', () => {
    expect(isStandardJSONSchema({ foo: 'bar' })).toBe(false);
  });

  test('returns false for missing version', () => {
    const schema = {
      '~standard': {
        vendor: 'zod',
        jsonSchema: { input: () => ({}), output: () => ({}) },
      },
    };
    expect(isStandardJSONSchema(schema)).toBe(false);
  });

  test('returns false for missing vendor', () => {
    const schema = {
      '~standard': {
        version: 1,
        jsonSchema: { input: () => ({}), output: () => ({}) },
      },
    };
    expect(isStandardJSONSchema(schema)).toBe(false);
  });

  test('returns false for missing jsonSchema.output', () => {
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'zod',
        jsonSchema: {},
      },
    };
    expect(isStandardJSONSchema(schema)).toBe(false);
  });

  test('returns false for non-object', () => {
    expect(isStandardJSONSchema(null)).toBe(false);
    expect(isStandardJSONSchema(undefined)).toBe(false);
    expect(isStandardJSONSchema('string')).toBe(false);
    expect(isStandardJSONSchema(42)).toBe(false);
  });
});

describe('resolveCompiledPath', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-resolve-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('finds .js in same directory', () => {
    const tsPath = path.join(tempDir, 'index.ts');
    const jsPath = path.join(tempDir, 'index.js');
    fs.writeFileSync(tsPath, '');
    fs.writeFileSync(jsPath, '');

    const result = resolveCompiledPath(tsPath, tempDir);
    expect(result).toBe(jsPath);
  });

  test('finds .js in dist directory', () => {
    const srcDir = path.join(tempDir, 'src');
    const distDir = path.join(tempDir, 'dist');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(distDir, { recursive: true });

    const tsPath = path.join(srcDir, 'index.ts');
    const jsPath = path.join(distDir, 'index.js');
    fs.writeFileSync(tsPath, '');
    fs.writeFileSync(jsPath, '');

    const result = resolveCompiledPath(tsPath, tempDir);
    expect(result).toBe(jsPath);
  });

  test('returns null when no compiled file found', () => {
    const tsPath = path.join(tempDir, 'index.ts');
    fs.writeFileSync(tsPath, '');

    const result = resolveCompiledPath(tsPath, tempDir);
    expect(result).toBeNull();
  });
});

describe('extractStandardSchemas', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-extract-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('extracts Standard Schema from module', async () => {
    const jsFile = path.join(tempDir, 'index.js');
    fs.writeFileSync(
      jsFile,
      `
      const UserSchema = {
        '~standard': {
          version: 1,
          vendor: 'zod',
          jsonSchema: {
            input: () => ({
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' }
              },
              required: ['name']
            }),
            output: () => ({
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' }
              },
              required: ['name']
            })
          }
        }
      };

      module.exports = { UserSchema };
    `,
    );

    const result = await extractStandardSchemas(jsFile);

    expect(result.errors).toHaveLength(0);
    expect(result.schemas.size).toBe(1);
    expect(result.schemas.has('UserSchema')).toBe(true);

    const schema = result.schemas.get('UserSchema');
    expect(schema?.vendor).toBe('zod');
    expect(schema?.outputSchema).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    });
  });

  test('extracts multiple Standard Schema exports', async () => {
    const jsFile = path.join(tempDir, 'index.js');
    fs.writeFileSync(
      jsFile,
      `
      const createSchema = (type) => ({
        '~standard': {
          version: 1,
          vendor: 'valibot',
          jsonSchema: {
            input: () => ({ type }),
            output: () => ({ type })
          }
        }
      });

      module.exports = {
        StringSchema: createSchema('string'),
        NumberSchema: createSchema('number'),
        BooleanSchema: createSchema('boolean'),
      };
    `,
    );

    const result = await extractStandardSchemas(jsFile);

    expect(result.errors).toHaveLength(0);
    expect(result.schemas.size).toBe(3);
    expect(result.schemas.get('StringSchema')?.outputSchema).toEqual({ type: 'string' });
    expect(result.schemas.get('NumberSchema')?.outputSchema).toEqual({ type: 'number' });
    expect(result.schemas.get('BooleanSchema')?.outputSchema).toEqual({ type: 'boolean' });
  });

  test('skips exports without ~standard', async () => {
    const jsFile = path.join(tempDir, 'index.js');
    fs.writeFileSync(
      jsFile,
      `
      module.exports = {
        plainObject: { foo: 'bar' },
        plainFunction: () => {},
        plainString: 'hello',
      };
    `,
    );

    const result = await extractStandardSchemas(jsFile);

    expect(result.errors).toHaveLength(0);
    expect(result.schemas.size).toBe(0);
  });

  test('skips underscore-prefixed exports', async () => {
    const jsFile = path.join(tempDir, 'index.js');
    fs.writeFileSync(
      jsFile,
      `
      const _internal = {
        '~standard': {
          version: 1,
          vendor: 'test',
          jsonSchema: { input: () => ({ type: 'string' }), output: () => ({ type: 'string' }) }
        }
      };

      module.exports = { _internal };
    `,
    );

    const result = await extractStandardSchemas(jsFile);

    expect(result.schemas.size).toBe(0);
  });

  test('returns error for non-existent file', async () => {
    const result = await extractStandardSchemas('/nonexistent/file.js');

    expect(result.schemas.size).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('not found');
  });

  test('handles module with syntax error gracefully', async () => {
    const jsFile = path.join(tempDir, 'broken.js');
    fs.writeFileSync(jsFile, 'this is not valid javascript {{{');

    const result = await extractStandardSchemas(jsFile);

    expect(result.schemas.size).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('handles schema extraction error gracefully', async () => {
    const jsFile = path.join(tempDir, 'index.js');
    fs.writeFileSync(
      jsFile,
      `
      const BrokenSchema = {
        '~standard': {
          version: 1,
          vendor: 'test',
          jsonSchema: {
            input: () => { throw new Error('Extraction failed'); },
            output: () => { throw new Error('Extraction failed'); }
          }
        }
      };

      module.exports = { BrokenSchema };
    `,
    );

    const result = await extractStandardSchemas(jsFile);

    // Should not crash, but schema won't be included
    expect(result.schemas.has('BrokenSchema')).toBe(false);
  });
});
