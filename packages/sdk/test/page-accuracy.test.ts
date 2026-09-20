/**
 * Accuracy fixtures modeled on Buoy dogfood (lively + @driftdev/sdk).
 * Rule hits must not cry wolf; candidates are inventory.
 */
import { describe, expect, test } from 'bun:test';
import type { ApiSpec } from '../src/analysis/api-spec';
import { buildExportRegistry } from '../src/analysis/drift/compute';
import { detectProseDrift } from '../src/analysis/drift/prose-drift';
import { parseMarkdownFile } from '../src/markdown/parser';
import { buildPageDocument } from '../src/page';
import { collectHeadings } from '../src/page/locators';

const PKG = '@waits/lively-react';

function roomSpec(): ApiSpec {
  return {
    meta: { name: PKG },
    exports: [
      {
        id: 'Room',
        name: 'Room',
        kind: 'class',
        members: [
          { name: 'roomId', kind: 'property' },
          { name: 'getStorage', kind: 'method' },
          { name: 'subscribe', kind: 'method' },
        ],
      },
      {
        id: 'useStorage',
        name: 'useStorage',
        kind: 'function',
        signatures: [{ returns: { schema: { $ref: '#/types/Room' } } }],
      },
      {
        id: 'Drift',
        name: 'Drift',
        kind: 'class',
        members: [
          { name: 'analyzeFile', kind: 'method' },
          { name: 'scan', kind: 'method' },
        ],
      },
      {
        id: 'createClient',
        name: 'createClient',
        kind: 'function',
        signatures: [{ returns: { schema: { $ref: '#/types/Drift' } } }],
      },
    ],
  };
}

function page(file: string, content: string, map?: { page: string; type: string }[]) {
  const spec = roomSpec();
  return buildPageDocument({
    spec,
    registry: buildExportRegistry(spec),
    file,
    content,
    packageName: spec.meta.name,
    ...(map ? { docsMap: { pages: map } } : {}),
  });
}

function rules(doc: ReturnType<typeof page>) {
  return doc.claims.filter((c) => c.rule);
}

function gaps(doc: ReturnType<typeof page>) {
  return doc.claims.filter((c) => c.rule?.type === 'spec-not-in-claims');
}

describe('spec-not-in-claims is scoped', () => {
  test('mentioning Room on an unrelated hook page is not a gap dump', () => {
    const doc = page(
      'docs/hooks/use-storage.md',
      '# useStorage\n\nReads storage. Mentions `Room` once.\n',
    );
    expect(gaps(doc)).toEqual([]);
    const mention = doc.claims.find((c) => c.text === 'Room');
    expect(mention?.candidate).toBe(true);
    expect(mention?.rule).toBeUndefined();
  });

  test('docs-map join emits gaps for unmentioned members of that type only', () => {
    const doc = page('docs/hooks/use-storage.md', '# useStorage\n\n`getStorage` is covered.\n', [
      { page: 'docs/hooks/use-storage.md', type: 'Room' },
    ]);
    expect(
      gaps(doc)
        .map((c) => c.text)
        .sort(),
    ).toEqual(['roomId', 'subscribe']);
  });

  test('heading that names the type joins gaps without a map', () => {
    const doc = page('docs/api/room.md', '# Room\n\nThe room handle.\n');
    expect(
      gaps(doc)
        .map((c) => c.text)
        .sort(),
    ).toEqual(['getStorage', 'roomId', 'subscribe']);
  });

  test('heading that names a member joins sibling members without a map', () => {
    const doc = page('docs/api/room.md', '# getStorage\n\nFetch the CRDT root.\n');
    expect(
      gaps(doc)
        .map((c) => c.text)
        .sort(),
    ).toEqual(['roomId', 'subscribe']);
  });
});

describe('prose-unresolved-member polarity', () => {
  const spec = roomSpec();
  const registry = buildExportRegistry(spec);

  function unresolved(md: string) {
    const file = parseMarkdownFile(md, 'docs/guide.md');
    return detectProseDrift({ packageName: PKG, markdownFiles: [file], registry })
      .filter((i) => i.type === 'prose-unresolved-member')
      .map((i) => i.target);
  }

  test('globals, React, DOM, and strings never fire', () => {
    const md = `# Guide

\`\`\`ts
crypto.randomUUID()
React.lazy(() => import("./Editor"))
input.trim()
sel.getRangeAt(0)
toast.info("ok")
\`\`\`
`;
    expect(unresolved(md)).toEqual([]);
    const doc = page('docs/hooks/use-follow-user.md', md);
    expect(rules(doc).filter((c) => c.rule?.type === 'prose-unresolved-member')).toEqual([]);
  });

  test('new ExportedClass().missingMethod is flagged', () => {
    const md = `# SDK

\`\`\`ts
const drift = new Drift();
await drift.analyzeFolder('src');
\`\`\`
`;
    expect(unresolved(md)).toEqual(['drift.analyzeFolder']);
  });

  test('destructure of an exported call is flagged', () => {
    const md = `# SDK

\`\`\`ts
const { client } = createClient();
client.analyzeFolder('src');
\`\`\`
`;
    expect(unresolved(md)).toEqual(['client.analyzeFolder']);
  });
});

describe('mapped ActivityTracker gaps (lively /docs/client)', () => {
  const spec: ApiSpec = {
    meta: { name: PKG },
    exports: [
      {
        id: 'ActivityTracker',
        name: 'ActivityTracker',
        kind: 'class',
        members: [
          { name: 'start', kind: 'method' },
          { name: 'getStatus', kind: 'method' },
          { name: 'stop', kind: 'method' },
          { name: 'getLastActivity', kind: 'method' },
          { name: '_status', kind: 'property', visibility: 'private' },
          { name: '_pollTimer', kind: 'property', visibility: 'private' },
          { name: '_check', kind: 'method', visibility: 'private' },
          { name: 'idleMs', kind: 'property' },
        ],
      },
    ],
  };

  const content = `# Client

Talks to the server. See \`ActivityTracker\`.

## ActivityTracker

Polls for idle users.

\`\`\`ts
const tracker = new ActivityTracker({ idleMs: 30_000 });
tracker.start(userId);
const status = tracker.getStatus();
tracker.stop();
\`\`\`
`;

  const map = [
    {
      page: '/docs/client',
      type: 'ActivityTracker',
      internal: ['_status', '_pollTimer', '_check', 'idleMs'],
    },
  ];

  function doc() {
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/client.md',
      content,
      packageName: PKG,
      docsMap: { pages: map },
    });
  }

  test('map page /docs/client matches docs/client.md so internal is applied', () => {
    const g = gaps(doc())
      .map((c) => c.text)
      .sort();
    expect(g).not.toContain('_status');
    expect(g).not.toContain('idleMs');
  });

  test('internal map keys and private/underscore members are not gaps', () => {
    const g = gaps(doc())
      .map((c) => c.text)
      .sort();
    expect(g).not.toContain('_status');
    expect(g).not.toContain('_pollTimer');
    expect(g).not.toContain('_check');
    expect(g).not.toContain('idleMs');
  });

  test('private underscore members are skipped even without a map', () => {
    const d = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/client.md',
      content: '# ActivityTracker\n',
      packageName: PKG,
    });
    const g = gaps(d).map((c) => c.text);
    expect(g).not.toContain('_status');
    expect(g).not.toContain('_pollTimer');
    expect(g).not.toContain('_check');
  });

  test('instance calls on new ActivityTracker() count as mentioned', () => {
    expect(
      gaps(doc())
        .map((c) => c.text)
        .sort(),
    ).toEqual(['getLastActivity']);
  });

  test('gap locator is the heading that names the type, not the page title', () => {
    const gap = gaps(doc())[0];
    expect(gap.locator.headingText).toBe('ActivityTracker');
    expect(gap.locator.headingId).toBe('activitytracker');
    expect(gap.locator.start.line).toBe(5);
  });
});

describe('headingText is unwrapped heading text, not the slug', () => {
  test('spaces and case survive; headingId is the slug', () => {
    const headings = collectHeadings(
      '# Browser\n\n## Empty session\n\n## Mutation with arguments\n',
    );
    expect(headings[1].text).toBe('Empty session');
    expect(headings[1].id).toBe('empty-session');
    expect(headings[1].text).not.toBe(headings[1].id);
    expect(headings[2].text).toBe('Mutation with arguments');
    expect(headings[2].id).toBe('mutation-with-arguments');
  });
});
