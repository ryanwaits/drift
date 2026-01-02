import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import { exportToMarkdown, toMarkdown } from './markdown';

const sampleSpec: OpenPkg = {
  openpkg: '0.4.0',
  meta: {
    ecosystem: 'js/ts',
    name: 'test-lib',
    version: '1.0.0',
    description: 'A test library for documentation',
  },
  exports: [
    {
      id: 'greet',
      name: 'greet',
      kind: 'function',
      description: 'Greet a user by name.',
      signatures: [
        {
          parameters: [
            { name: 'name', schema: { type: 'string' }, required: true, description: 'User name' },
            { name: 'formal', schema: { type: 'boolean' }, required: false, default: false },
          ],
          returns: { schema: { type: 'string' }, description: 'Greeting message' },
        },
      ],
      examples: [{ title: 'Basic', code: 'greet("World")', language: 'ts' }],
    },
    {
      id: 'Logger',
      name: 'Logger',
      kind: 'class',
      description: 'Logging utility class.',
      deprecated: true,
      members: [
        {
          name: 'info',
          kind: 'method',
          description: 'Log info',
          signatures: [
            {
              parameters: [{ name: 'msg', schema: { type: 'string' } }],
              returns: { schema: { type: 'void' } },
            },
          ],
        },
        { name: 'level', kind: 'property', description: 'Log level', schema: { type: 'string' } },
      ],
    },
    {
      id: 'Config',
      name: 'Config',
      kind: 'interface',
      description: 'Configuration interface.',
      members: [{ name: 'debug', kind: 'property', schema: { type: 'boolean' } }],
    },
    {
      id: 'LogLevel',
      name: 'LogLevel',
      kind: 'enum',
      description: 'Log level enum.',
      members: [
        { name: 'DEBUG', kind: 'enum-member', description: 'Debug level' },
        { name: 'INFO', kind: 'enum-member', description: 'Info level' },
      ],
    },
  ],
};

describe('exportToMarkdown', () => {
  test('renders function export', () => {
    const exp = sampleSpec.exports[0];
    const mdx = exportToMarkdown(exp);

    expect(mdx).toMatchSnapshot();
  });

  test('renders class export', () => {
    const exp = sampleSpec.exports[1];
    const mdx = exportToMarkdown(exp);

    expect(mdx).toMatchSnapshot();
  });

  test('renders interface export', () => {
    const exp = sampleSpec.exports[2];
    const mdx = exportToMarkdown(exp);

    expect(mdx).toMatchSnapshot();
  });

  test('renders enum export', () => {
    const exp = sampleSpec.exports[3];
    const mdx = exportToMarkdown(exp);

    expect(mdx).toMatchSnapshot();
  });

  test('respects frontmatter option', () => {
    const exp = sampleSpec.exports[0];
    const withFrontmatter = exportToMarkdown(exp, { frontmatter: true });
    const withoutFrontmatter = exportToMarkdown(exp, { frontmatter: false });

    expect(withFrontmatter).toContain('---');
    expect(withoutFrontmatter).not.toContain('---');
  });

  test('respects codeSignatures option', () => {
    const exp = sampleSpec.exports[0];
    const mdx = exportToMarkdown(exp, { codeSignatures: true });

    expect(mdx).toContain('```ts');
    expect(mdx).toContain('function greet');
  });

  test('respects headingOffset option', () => {
    const exp = sampleSpec.exports[0];
    const mdx = exportToMarkdown(exp, { headingOffset: 1 });

    expect(mdx).toContain('## greet'); // h1 offset to h2
  });

  test('respects sections option', () => {
    const exp = sampleSpec.exports[0];
    const mdx = exportToMarkdown(exp, { sections: { examples: false } });

    expect(mdx).not.toContain('## Examples');
  });
});

describe('toMarkdown', () => {
  test('renders full spec', () => {
    const mdx = toMarkdown(sampleSpec);

    expect(mdx).toMatchSnapshot();
  });

  test('renders single export mode', () => {
    const mdx = toMarkdown(sampleSpec, { export: 'greet' });

    expect(mdx).toContain('# greet');
    expect(mdx).not.toContain('# test-lib');
  });

  test('throws for unknown export', () => {
    expect(() => toMarkdown(sampleSpec, { export: 'unknown' })).toThrow('Export not found');
  });

  test('includes custom frontmatter', () => {
    const mdx = toMarkdown(sampleSpec, {
      customFrontmatter: { sidebar_position: 1 },
    });

    expect(mdx).toContain('sidebar_position: 1');
  });
});
