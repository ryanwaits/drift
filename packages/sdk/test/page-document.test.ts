import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { ApiSpec } from '../src/analysis/api-spec';
import { buildExportRegistry } from '../src/analysis/drift/compute';
import { detectProseDrift } from '../src/analysis/drift/prose-drift';
import { parseMarkdownFile } from '../src/markdown/parser';
import type { Claim, PageDocument } from '../src/page';
import { buildPageDocument, buildPageDocuments } from '../src/page';
import { CLARINET_PKG, clarinetRegistry, clarinetSpec } from '../src/page/fixtures/clarinet/spec';
import { locateSpan } from '../src/page/locators';

const FIXTURES = path.resolve(__dirname, '../src/page/fixtures/clarinet');

function load(name: string): string {
  return readFileSync(path.join(FIXTURES, name), 'utf-8');
}

const CLARINET_MAP = {
  pages: [
    { page: 'docs/browser-sdk-reference.md', type: 'Simnet' },
    { page: 'docs/sdk-reference.md', type: 'Simnet' },
  ],
};

function build(file: string, content: string, spec = clarinetSpec()): PageDocument {
  return buildPageDocument({
    spec,
    registry: buildExportRegistry(spec),
    file,
    content,
    packageName: spec.meta.name,
    docsMap: CLARINET_MAP,
  });
}

function claimOf(doc: PageDocument, pred: (c: Claim) => boolean): Claim {
  const found = doc.claims.find(pred);
  expect(found).toBeDefined();
  return found!;
}

describe('PageDocument clarinet fixture', () => {
  const spec = clarinetSpec();
  const registry = clarinetRegistry();
  const browserMd = load('browser-sdk-reference.md');
  const sdkMd = load('sdk-reference.md');
  const browser = build('docs/browser-sdk-reference.md', browserMd, spec);
  const sdk = build('docs/sdk-reference.md', sdkMd, spec);

  test('deprecation rule fires on the stub registry', () => {
    const file = parseMarkdownFile(browserMd, 'docs/browser-sdk-reference.md');
    const issues = detectProseDrift({
      packageName: CLARINET_PKG,
      markdownFiles: [file],
      registry,
    });
    const dep = issues.filter((i) => i.type === 'prose-deprecated-reference');
    expect(dep).toHaveLength(1);
    expect(dep[0].target).toBe('runSnippet');
  });

  test('headingText is the written heading, not the slug', () => {
    const fence = claimOf(
      browser,
      (c) => c.kind === 'fence' && c.rule?.type === 'prose-deprecated-reference',
    );
    expect(fence.locator.headingId).toBe('empty-session');
    expect(fence.locator.headingText).toBe('Empty session');
  });

  test('browser fence: runSnippet deprecated, specRef + replacement', () => {
    const fence = claimOf(
      browser,
      (c) => c.kind === 'fence' && c.rule?.type === 'prose-deprecated-reference',
    );
    expect(fence.text).toBe('simnet.runSnippet("(+ 1 2)")');
    expect(fence.candidate).toBe(false);
    expect(fence.specRef?.export).toBe('Simnet');
    expect(fence.specRef?.member).toBe('runSnippet');
    expect(fence.specRef?.deprecated).toBe(true);
    expect(fence.specRef?.replacement).toBe('execute');
    expect(fence.locator.headingId).toBe('empty-session');
    expect(fence.locator.start.col).toBeGreaterThan(0);
    expect(fence.locator.end.col).toBeGreaterThan(fence.locator.start.col);
    expect(fence.locator.start.line).toBe(fence.locator.end.line);
    const span = locateSpan(browserMd, 'simnet.runSnippet("(+ 1 2)")');
    expect(fence.locator.start).toEqual(span?.start);
    expect(fence.locator.end).toEqual(span?.end);
  });

  test('sdk heading runSnippet is a candidate with specRef', () => {
    const heading = claimOf(sdk, (c) => c.kind === 'heading' && c.text === 'runSnippet');
    expect(heading.rule).toBeUndefined();
    expect(heading.candidate).toBe(true);
    expect(heading.specRef?.export).toBe('Simnet');
    expect(heading.specRef?.member).toBe('runSnippet');
    expect(heading.locator.headingId).toBe('runsnippet');
    expect(heading.locator.start.col).toBe(4);
  });

  test('sdk gap: missing execute is spec-not-in-claims', () => {
    const gap = claimOf(
      sdk,
      (c) => c.kind === 'gap' && c.rule?.type === 'spec-not-in-claims' && c.text === 'execute',
    );
    expect(gap.candidate).toBe(false);
    expect(gap.specRef?.export).toBe('Simnet');
    expect(gap.specRef?.member).toBe('execute');
    expect(gap.specRef?.deprecated).toBeUndefined();
    expect(gap.locator.headingId).toBe('runsnippet');
  });

  test('id stability', () => {
    const again = build('docs/sdk-reference.md', sdkMd, spec);
    expect(again.claims.map((c) => c.id)).toEqual(sdk.claims.map((c) => c.id));
    expect(sdk.claims.every((c) => c.id.startsWith('docs/sdk-reference.md:'))).toBe(true);
  });

  test('gap join is scoped to the referenced type', () => {
    expect(sdk.claims.filter((c) => c.kind === 'gap').map((c) => c.text)).toEqual(['execute']);
    expect(sdk.claims.some((c) => c.text === 'initSimnet' && c.kind === 'gap')).toBe(false);
  });

  test('unmapped page with no member mentions emits no gaps', () => {
    const doc = build(
      'docs/install.md',
      '# Install\n\n```bash\nnpm i @stacks/clarinet-sdk\n```\n',
      spec,
    );
    expect(doc.claims.filter((c) => c.kind === 'gap')).toEqual([]);
  });

  test('mentioning a type or function does not dump its members as gaps', () => {
    const fat: ApiSpec = {
      meta: { name: '@acme/sdk' },
      exports: [
        {
          id: 'LiveObject',
          name: 'LiveObject',
          kind: 'class',
          members: Array.from({ length: 20 }, (_, i) => ({ name: `m${i}`, kind: 'method' })),
          schema: {
            type: 'object',
            properties: Object.fromEntries(
              Array.from({ length: 200 }, (_, i) => [`k${i}`, { type: 'string' }]),
            ),
          },
        },
        {
          id: 'useStorage',
          name: 'useStorage',
          kind: 'function',
          signatures: [{ returns: { schema: { $ref: '#/types/LiveObject' } } }],
        },
      ],
    };
    const doc = build('docs/hooks.md', '# Storage\n\nUse `useStorage` with a `LiveObject`.\n', fat);
    expect(doc.claims.filter((c) => c.kind === 'gap')).toEqual([]);
  });

  test('golden stringify', () => {
    const docs = buildPageDocuments({
      spec,
      registry,
      docsMap: CLARINET_MAP,
      files: [
        { file: 'docs/browser-sdk-reference.md', content: browserMd },
        { file: 'docs/sdk-reference.md', content: sdkMd },
      ],
    });
    const goldenPath = path.join(FIXTURES, 'pages.json');
    const actual = `${JSON.stringify(docs, null, 2)}\n`;
    const expected = readFileSync(goldenPath, 'utf-8');
    expect(actual).toBe(expected);
  });

  test('candidates never carry a rule', () => {
    for (const doc of [browser, sdk]) {
      for (const c of doc.claims) {
        if (c.candidate) expect(c.rule).toBeUndefined();
        if (c.rule) expect(c.candidate).toBe(false);
      }
    }
  });
});

describe('PageDocument locators + table keys', () => {
  test('inline backtick col and heading slug', () => {
    const spec: ApiSpec = {
      meta: { name: '@acme/sdk' },
      exports: [{ id: 'createClient', name: 'createClient', kind: 'function' }],
    };
    const content = '# Guide\n\nCall `createClient` first.\n';
    const doc = build('docs/guide.md', content, spec);
    const inline = claimOf(doc, (c) => c.kind === 'inline');
    expect(inline.text).toBe('createClient');
    expect(inline.candidate).toBe(true);
    expect(inline.locator.headingId).toBe('guide');
    expect(inline.locator.start.line).toBe(3);
    expect(inline.locator.start.col).toBe(6);
    expect(inline.locator.end.col).toBe(6 + 'createClient'.length - 1 + 2); // wrapped in ` `
  });

  test('table-key ghost and key-gap attach rules', () => {
    const spec: ApiSpec = {
      meta: { name: '@acme/sdk' },
      exports: [
        {
          id: 'Options',
          name: 'Options',
          kind: 'type',
          members: [
            { name: 'host', kind: 'property' },
            { name: 'timeout', kind: 'property' },
          ],
        },
      ],
    };
    const content = `# Config

## Configuration options

| Option | Description |
| --- | --- |
| \`host\` | API host |
| \`ghostKey\` | missing |
`;
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/config.md',
      content,
      docsMap: { pages: [{ page: 'docs/config.md', type: 'Options' }] },
    });
    const host = claimOf(doc, (c) => c.kind === 'table-key' && c.text === 'host');
    expect(host.rule).toBeUndefined();
    expect(host.specRef?.export).toBe('Options');
    const ghost = claimOf(doc, (c) => c.rule?.type === 'key-ghost');
    expect(ghost.specRef).toBeNull();
    expect(ghost.text).toBe('ghostKey');
    const gap = claimOf(doc, (c) => c.rule?.type === 'key-gap' && c.text === 'timeout');
    expect(gap.kind).toBe('gap');
    expect(gap.specRef?.member).toBe('timeout');
  });
});
