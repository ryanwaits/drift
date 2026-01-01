/**
 * Tests for type formatting and schema generation.
 *
 * These tests use a minimal TypeScript program to test formatTypeReference
 * with real TypeScript types.
 */
import { describe, expect, test } from 'bun:test';
import * as ts from 'typescript';
import { formatTypeReference, propertiesToSchema } from '../src/utils/parameter-utils';

/**
 * Create a minimal TypeScript program for testing type formatting.
 */
function createTestProgram(source: string) {
  const fileName = 'test.ts';
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    strict: true,
    noEmit: true,
  };

  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.ESNext, true);

  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (name, languageVersion) => {
    if (name === fileName) return sourceFile;
    return originalGetSourceFile(name, languageVersion);
  };

  const program = ts.createProgram([fileName], compilerOptions, host);
  return {
    program,
    sourceFile,
    typeChecker: program.getTypeChecker(),
  };
}

/**
 * Get the type of the first variable declaration in a source.
 */
function getFirstVarType(source: string) {
  const { sourceFile, typeChecker } = createTestProgram(source);

  let varType: ts.Type | null = null;
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      const decl = node.declarationList.declarations[0];
      if (decl) {
        varType = typeChecker.getTypeAtLocation(decl);
      }
    }
  });

  return { type: varType!, typeChecker };
}

describe('formatTypeReference', () => {
  describe('primitive types', () => {
    test('formats string type', () => {
      const { type, typeChecker } = getFirstVarType('const x: string = "";');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ type: 'string' });
    });

    test('formats number type', () => {
      const { type, typeChecker } = getFirstVarType('const x: number = 0;');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ type: 'number' });
    });

    test('formats boolean type', () => {
      const { type, typeChecker } = getFirstVarType('const x: boolean = true;');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ type: 'boolean' });
    });

    test('formats null type', () => {
      const { type, typeChecker } = getFirstVarType('const x: null = null;');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ type: 'null' });
    });

    test('formats undefined type', () => {
      const { type, typeChecker } = getFirstVarType('const x: undefined = undefined;');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ type: 'null' });
    });

    test('formats any type', () => {
      const { type, typeChecker } = getFirstVarType('const x: any = {};');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ type: 'any' });
    });

    test('formats unknown type', () => {
      const { type, typeChecker } = getFirstVarType('const x: unknown = {};');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ type: 'unknown' });
    });

    test('formats bigint type', () => {
      const { type, typeChecker } = getFirstVarType('const x: bigint = 0n;');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ type: 'string', format: 'bigint' });
    });
  });

  describe('literal types', () => {
    test('formats string literal', () => {
      const { type, typeChecker } = getFirstVarType('const x = "hello" as const;');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ enum: ['hello'] });
    });

    test('formats number literal', () => {
      const { type, typeChecker } = getFirstVarType('const x = 42 as const;');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ enum: [42] });
    });
  });

  describe('union types', () => {
    test('formats simple union', () => {
      const { type, typeChecker } = getFirstVarType('const x: string | number = "";');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toHaveProperty('anyOf');
      const anyOf = (result as any).anyOf;
      expect(anyOf).toContainEqual({ type: 'string' });
      expect(anyOf).toContainEqual({ type: 'number' });
    });

    test('formats nullable type', () => {
      const { type, typeChecker } = getFirstVarType('const x: string | null = "";');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toHaveProperty('anyOf');
      const anyOf = (result as any).anyOf;
      expect(anyOf).toContainEqual({ type: 'string' });
      expect(anyOf).toContainEqual({ type: 'null' });
    });

    test('formats optional (undefined union)', () => {
      const { type, typeChecker } = getFirstVarType('const x: string | undefined = "";');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toHaveProperty('anyOf');
      const anyOf = (result as any).anyOf;
      expect(anyOf).toContainEqual({ type: 'string' });
      expect(anyOf).toContainEqual({ type: 'null' });
    });

    test('deduplicates null and undefined', () => {
      const { type, typeChecker } = getFirstVarType('const x: string | null | undefined = "";');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toHaveProperty('anyOf');
      const anyOf = (result as any).anyOf;
      // Should have string and one null (deduplicated)
      expect(anyOf).toHaveLength(2);
    });

    test('unwraps single-item anyOf', () => {
      // After deduplication, should unwrap
      const { type, typeChecker } = getFirstVarType('const x: null | undefined = null;');
      const result = formatTypeReference(type, typeChecker, new Map());

      // Should collapse to single { type: 'null' }
      expect(result).toEqual({ type: 'null' });
    });
  });

  describe('intersection types', () => {
    test('formats simple intersection', () => {
      const { type, typeChecker } = getFirstVarType(`
        type A = { a: string };
        type B = { b: number };
        const x: A & B = { a: "", b: 0 };
      `);
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toHaveProperty('allOf');
    });
  });

  describe('object types', () => {
    test('formats inline object', () => {
      const { type, typeChecker } = getFirstVarType(
        'const x: { name: string; age: number } = { name: "", age: 0 };',
      );
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toHaveProperty('type', 'object');
      expect(result).toHaveProperty('properties');
      expect((result as any).properties.name).toEqual({ type: 'string' });
      expect((result as any).properties.age).toEqual({ type: 'number' });
    });

    test('tracks required properties', () => {
      const { type, typeChecker } = getFirstVarType(
        'const x: { required: string; optional?: number } = { required: "" };',
      );
      const result = formatTypeReference(type, typeChecker, new Map());

      expect((result as any).required).toContain('required');
      expect((result as any).required).not.toContain('optional');
    });
  });

  describe('type references', () => {
    test('generates $ref for known types', () => {
      const { type, typeChecker } = getFirstVarType(`
        interface User { name: string }
        const x: User = { name: "" };
      `);

      const typeRefs = new Map([['User', 'User']]);
      const result = formatTypeReference(type, typeChecker, typeRefs);

      expect(result).toEqual({ $ref: '#/types/User' });
    });

    test('tracks referenced types', () => {
      const { type, typeChecker } = getFirstVarType(`
        interface User { name: string }
        const x: User = { name: "" };
      `);

      const typeRefs = new Map<string, string>();
      const referencedTypes = new Set<string>();
      formatTypeReference(type, typeChecker, typeRefs, referencedTypes);

      expect(referencedTypes.has('User')).toBe(true);
    });
  });

  describe('built-in types', () => {
    test('formats Date as date-time string', () => {
      const { type, typeChecker } = getFirstVarType('const x: Date = new Date();');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ type: 'string', format: 'date-time' });
    });

    test('formats Array as array with items', () => {
      const { type, typeChecker } = getFirstVarType('const x: Array<string> = [];');
      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toEqual({ type: 'array', items: { type: 'string' } });
    });
  });

  describe('recursion protection', () => {
    test('handles deep recursion with maxDepth', () => {
      // Create a deeply nested type
      const { type, typeChecker } = getFirstVarType(`
        type Deep = { nested: Deep };
        const x: Deep = { nested: { nested: {} as Deep } };
      `);

      const result = formatTypeReference(type, typeChecker, new Map(), undefined, undefined, 0, 3);

      // Should not throw and should return something
      expect(result).toBeDefined();
    });

    test('returns unknown for excessive depth', () => {
      const { type, typeChecker } = getFirstVarType(`
        type Deep = { nested: Deep };
        const x: Deep = { nested: { nested: {} as Deep } };
      `);

      // Start at depth already past limit
      const result = formatTypeReference(
        type,
        typeChecker,
        new Map(),
        undefined,
        undefined,
        100,
        10,
      );

      expect(result).toEqual({ type: 'unknown' });
    });
  });

  describe('discriminated unions', () => {
    test('detects discriminator property', () => {
      const { type, typeChecker } = getFirstVarType(`
        type A = { kind: 'a'; value: string };
        type B = { kind: 'b'; value: number };
        type Union = A | B;
        const x: Union = { kind: 'a', value: '' };
      `);

      const result = formatTypeReference(type, typeChecker, new Map());

      expect(result).toHaveProperty('anyOf');
      expect(result).toHaveProperty('discriminator');
      expect((result as any).discriminator.propertyName).toBe('kind');
    });
  });
});

describe('propertiesToSchema', () => {
  test('converts properties array to object schema', () => {
    const result = propertiesToSchema([
      { name: 'name', type: { type: 'string' } },
      { name: 'age', type: { type: 'number' } },
    ]);

    expect(result).toHaveProperty('type', 'object');
    expect(result).toHaveProperty('properties');
    expect((result as any).properties.name).toEqual({ type: 'string' });
    expect((result as any).properties.age).toEqual({ type: 'number' });
  });

  test('marks required properties', () => {
    const result = propertiesToSchema([
      { name: 'required', type: { type: 'string' } },
      { name: 'optional', type: { type: 'string' }, optional: true },
    ]);

    expect((result as any).required).toContain('required');
    expect((result as any).required).not.toContain('optional');
  });

  test('includes property descriptions', () => {
    const result = propertiesToSchema([
      { name: 'field', type: { type: 'string' }, description: 'A field' },
    ]);

    expect((result as any).properties.field.description).toBe('A field');
  });

  test('handles $ref types', () => {
    const result = propertiesToSchema([{ name: 'user', type: { $ref: '#/types/User' } }]);

    expect((result as any).properties.user).toEqual({ $ref: '#/types/User' });
  });

  test('wraps $ref with description using allOf', () => {
    const result = propertiesToSchema([
      { name: 'user', type: { $ref: '#/types/User' }, description: 'The user' },
    ]);

    // Should use allOf pattern to preserve $ref while adding description
    expect((result as any).properties.user).toEqual({
      allOf: [{ $ref: '#/types/User' }],
      description: 'The user',
    });
  });

  test('handles string type shorthand', () => {
    const result = propertiesToSchema([{ name: 'field', type: 'string' }]);

    expect((result as any).properties.field).toEqual({ type: 'string' });
  });

  test('handles primitive type strings', () => {
    const result = propertiesToSchema([
      { name: 'str', type: 'string' },
      { name: 'num', type: 'number' },
      { name: 'bool', type: 'boolean' },
      { name: 'big', type: 'bigint' },
      { name: 'nil', type: 'null' },
    ]);

    expect((result as any).properties.str).toEqual({ type: 'string' });
    expect((result as any).properties.num).toEqual({ type: 'number' });
    expect((result as any).properties.bool).toEqual({ type: 'boolean' });
    expect((result as any).properties.big).toEqual({ type: 'string' });
    expect((result as any).properties.nil).toEqual({ type: 'null' });
  });

  test('includes schema description', () => {
    const result = propertiesToSchema(
      [{ name: 'field', type: { type: 'string' } }],
      'The options object',
    );

    expect((result as any).description).toBe('The options object');
  });
});
