import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecExport, SpecMember, SpecSchema } from '@openpkg-ts/spec';
import {
  buildSignatureString,
  formatParameters,
  formatReturnType,
  formatSchema,
  formatTypeParameters,
  getMethods,
  getProperties,
  groupByVisibility,
  isMethod,
  isProperty,
  resolveTypeRef,
  sortByName,
} from './query';

describe('formatSchema', () => {
  test('returns unknown for undefined', () => {
    expect(formatSchema(undefined)).toBe('unknown');
  });

  test('returns string schema as-is', () => {
    expect(formatSchema('string')).toBe('string');
  });

  test('formats basic type', () => {
    expect(formatSchema({ type: 'string' })).toBe('string');
    expect(formatSchema({ type: 'number' })).toBe('number');
    expect(formatSchema({ type: 'boolean' })).toBe('boolean');
  });

  test('formats $ref', () => {
    expect(formatSchema({ $ref: '#/types/User' })).toBe('User');
    expect(formatSchema({ $ref: '#/types/Config' })).toBe('Config');
  });

  test('formats union (anyOf)', () => {
    const schema: SpecSchema = {
      anyOf: [{ type: 'string' }, { type: 'number' }],
    };
    expect(formatSchema(schema)).toBe('string | number');
  });

  test('formats intersection (allOf)', () => {
    const schema: SpecSchema = {
      allOf: [{ $ref: '#/types/A' }, { $ref: '#/types/B' }],
    };
    expect(formatSchema(schema)).toBe('A & B');
  });

  test('formats array', () => {
    const schema: SpecSchema = {
      type: 'array',
      items: { type: 'string' },
    };
    expect(formatSchema(schema)).toBe('string[]');
  });

  test('formats tuple', () => {
    const schema: SpecSchema = {
      type: 'tuple',
      items: [{ type: 'string' }, { type: 'number' }],
    };
    expect(formatSchema(schema)).toBe('[string, number]');
  });

  test('formats object with properties', () => {
    const schema: SpecSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    };
    expect(formatSchema(schema)).toBe('{ name: string; age: number }');
  });

  test('formats object without properties', () => {
    expect(formatSchema({ type: 'object' })).toBe('object');
  });
});

describe('formatTypeParameters', () => {
  test('returns empty string for no params', () => {
    expect(formatTypeParameters(undefined)).toBe('');
    expect(formatTypeParameters([])).toBe('');
  });

  test('formats single type param', () => {
    expect(formatTypeParameters([{ name: 'T' }])).toBe('<T>');
  });

  test('formats multiple type params', () => {
    expect(formatTypeParameters([{ name: 'T' }, { name: 'U' }])).toBe('<T, U>');
  });

  test('formats constraint', () => {
    expect(formatTypeParameters([{ name: 'T', constraint: 'object' }])).toBe('<T extends object>');
  });

  test('formats default', () => {
    expect(formatTypeParameters([{ name: 'T', default: 'unknown' }])).toBe('<T = unknown>');
  });

  test('formats constraint and default', () => {
    expect(formatTypeParameters([{ name: 'T', constraint: 'object', default: '{}' }])).toBe(
      '<T extends object = {}>',
    );
  });
});

describe('formatParameters', () => {
  test('returns empty parens for no signature', () => {
    expect(formatParameters(undefined)).toBe('()');
  });

  test('returns empty parens for no parameters', () => {
    expect(formatParameters({ parameters: [] })).toBe('()');
  });

  test('formats required param', () => {
    const sig = {
      parameters: [{ name: 'id', schema: { type: 'string' } as SpecSchema, required: true }],
    };
    expect(formatParameters(sig)).toBe('(id: string)');
  });

  test('formats optional param', () => {
    const sig = {
      parameters: [{ name: 'id', schema: { type: 'string' } as SpecSchema, required: false }],
    };
    expect(formatParameters(sig)).toBe('(id?: string)');
  });

  test('formats rest param', () => {
    const sig = {
      parameters: [
        {
          name: 'args',
          schema: { type: 'array', items: { type: 'string' } } as SpecSchema,
          rest: true,
        },
      ],
    };
    expect(formatParameters(sig)).toBe('(...args: string[])');
  });

  test('formats multiple params', () => {
    const sig = {
      parameters: [
        { name: 'a', schema: { type: 'string' } as SpecSchema, required: true },
        { name: 'b', schema: { type: 'number' } as SpecSchema, required: false },
      ],
    };
    expect(formatParameters(sig)).toBe('(a: string, b?: number)');
  });
});

describe('formatReturnType', () => {
  test('returns void for no signature', () => {
    expect(formatReturnType(undefined)).toBe('void');
  });

  test('returns void for no returns', () => {
    expect(formatReturnType({ parameters: [] })).toBe('void');
  });

  test('formats return type', () => {
    const sig = {
      returns: { schema: { type: 'string' } as SpecSchema },
    };
    expect(formatReturnType(sig)).toBe('string');
  });
});

describe('buildSignatureString', () => {
  test('builds function signature', () => {
    const exp: SpecExport = {
      id: 'greet',
      name: 'greet',
      kind: 'function',
      signatures: [
        {
          parameters: [{ name: 'name', schema: { type: 'string' }, required: true }],
          returns: { schema: { type: 'string' } },
        },
      ],
    };
    expect(buildSignatureString(exp)).toBe('function greet(name: string): string');
  });

  test('builds function with type params', () => {
    const exp: SpecExport = {
      id: 'identity',
      name: 'identity',
      kind: 'function',
      typeParameters: [{ name: 'T' }],
      signatures: [
        {
          parameters: [{ name: 'value', schema: { $ref: 'T' }, required: true }],
          returns: { schema: { $ref: 'T' } },
        },
      ],
    };
    expect(buildSignatureString(exp)).toBe('function identity<T>(value: T): T');
  });

  test('builds class signature', () => {
    const exp: SpecExport = {
      id: 'Logger',
      name: 'Logger',
      kind: 'class',
    };
    expect(buildSignatureString(exp)).toBe('class Logger');
  });

  test('builds class with extends', () => {
    const exp: SpecExport = {
      id: 'Logger',
      name: 'Logger',
      kind: 'class',
      extends: 'EventEmitter',
    };
    expect(buildSignatureString(exp)).toBe('class Logger extends EventEmitter');
  });

  test('builds class with implements', () => {
    const exp: SpecExport = {
      id: 'Logger',
      name: 'Logger',
      kind: 'class',
      implements: ['Disposable', 'Iterable'],
    };
    expect(buildSignatureString(exp)).toBe('class Logger implements Disposable, Iterable');
  });

  test('builds interface signature', () => {
    const exp: SpecExport = {
      id: 'Config',
      name: 'Config',
      kind: 'interface',
    };
    expect(buildSignatureString(exp)).toBe('interface Config');
  });

  test('builds interface with extends', () => {
    const exp: SpecExport = {
      id: 'Config',
      name: 'Config',
      kind: 'interface',
      extends: 'BaseConfig',
    };
    expect(buildSignatureString(exp)).toBe('interface Config extends BaseConfig');
  });

  test('builds type alias', () => {
    const exp: SpecExport = {
      id: 'ID',
      name: 'ID',
      kind: 'type',
      type: 'string | number',
    };
    expect(buildSignatureString(exp)).toBe('type ID = string | number');
  });

  test('builds enum signature', () => {
    const exp: SpecExport = {
      id: 'Status',
      name: 'Status',
      kind: 'enum',
    };
    expect(buildSignatureString(exp)).toBe('enum Status');
  });

  test('builds variable signature', () => {
    const exp: SpecExport = {
      id: 'VERSION',
      name: 'VERSION',
      kind: 'variable',
      type: 'string',
    };
    expect(buildSignatureString(exp)).toBe('const VERSION: string');
  });
});

describe('resolveTypeRef', () => {
  const spec: OpenPkg = {
    openpkg: '0.4.0',
    meta: { ecosystem: 'js/ts', name: 'test' },
    exports: [],
    types: [
      { id: 'User', name: 'User', kind: 'interface' },
      { id: 'Config', name: 'Config', kind: 'type' },
    ],
  };

  test('resolves type ref', () => {
    const type = resolveTypeRef('#/types/User', spec);
    expect(type?.name).toBe('User');
  });

  test('returns undefined for unknown ref', () => {
    const type = resolveTypeRef('#/types/Unknown', spec);
    expect(type).toBeUndefined();
  });
});

describe('member utilities', () => {
  const members: SpecMember[] = [
    { name: 'foo', kind: 'method', signatures: [{ parameters: [] }] },
    { name: 'bar', kind: 'property', schema: { type: 'string' } },
    { name: 'baz', kind: 'method', signatures: [{ parameters: [] }] },
  ];

  test('isMethod identifies methods', () => {
    expect(isMethod(members[0])).toBe(true);
    expect(isMethod(members[1])).toBe(false);
  });

  test('isProperty identifies properties', () => {
    expect(isProperty(members[0])).toBe(false);
    expect(isProperty(members[1])).toBe(true);
  });

  test('getMethods filters methods', () => {
    const methods = getMethods(members);
    expect(methods).toHaveLength(2);
    expect(methods[0].name).toBe('foo');
  });

  test('getProperties filters properties', () => {
    const props = getProperties(members);
    expect(props).toHaveLength(1);
    expect(props[0].name).toBe('bar');
  });

  test('getMethods handles undefined', () => {
    expect(getMethods(undefined)).toEqual([]);
  });
});

describe('groupByVisibility', () => {
  const members: SpecMember[] = [
    { name: 'a', visibility: 'public' },
    { name: 'b', visibility: 'protected' },
    { name: 'c', visibility: 'private' },
    { name: 'd' }, // defaults to public
  ];

  test('groups by visibility', () => {
    const groups = groupByVisibility(members);
    expect(groups.public).toHaveLength(2);
    expect(groups.protected).toHaveLength(1);
    expect(groups.private).toHaveLength(1);
  });

  test('handles undefined', () => {
    const groups = groupByVisibility(undefined);
    expect(groups.public).toHaveLength(0);
  });
});

describe('sortByName', () => {
  test('sorts alphabetically', () => {
    const items = [{ name: 'charlie' }, { name: 'alpha' }, { name: 'bravo' }];
    const sorted = sortByName(items);
    expect(sorted.map((i) => i.name)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  test('returns new array', () => {
    const items = [{ name: 'b' }, { name: 'a' }];
    const sorted = sortByName(items);
    expect(sorted).not.toBe(items);
  });
});
