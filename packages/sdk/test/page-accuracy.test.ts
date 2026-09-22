/**
 * Accuracy fixtures modeled on Buoy dogfood (lively + @driftdev/sdk).
 * Rule hits must not cry wolf; candidates are inventory.
 */
import { describe, expect, test } from 'bun:test';
import type { ApiSpec } from '../src/analysis/api-spec';
import { buildExportRegistry } from '../src/analysis/drift/compute';
import { detectProseDrift } from '../src/analysis/drift/prose-drift';
import { parseMarkdownFile } from '../src/markdown/parser';
import { buildPageDocument, buildPageDocuments } from '../src/page';
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

  test('the value of an exported call is flagged; a destructured element is not that type', () => {
    const fence = (code: string) => `# SDK\n\n\`\`\`ts\n${code}\n\`\`\`\n`;
    expect(
      unresolved(fence("const client = createClient();\nclient.analyzeFolder('src');")),
    ).toEqual(['client.analyzeFolder']);
    expect(
      unresolved(fence("const { client } = createClient();\nclient.analyzeFolder('src');")),
    ).toEqual([]);
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

describe('member mentions inside fence comments (lively /docs/server)', () => {
  const spec: ApiSpec = {
    meta: { name: PKG },
    exports: [
      {
        id: 'LivelyServer',
        name: 'LivelyServer',
        kind: 'class',
        members: [
          { name: 'port', kind: 'property' },
          { name: 'start', kind: 'method' },
        ],
      },
    ],
  };

  function doc(content: string) {
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/server.md',
      content,
      packageName: PKG,
    });
  }

  test('bound.member in a line comment counts as mentioned; unshown member still gaps', () => {
    const d = doc(`# Server

## LivelyServer

\`\`\`ts
const server = new LivelyServer({ port: 1999 });
// server.port → 1999
\`\`\`
`);
    expect(gaps(d).map((c) => c.text)).toEqual(['start']);
  });

  test('bound.member in a block comment counts as mentioned', () => {
    const d = doc(`# Server

## LivelyServer

\`\`\`ts
const server = new LivelyServer({ port: 1999 });
/* server.port is 1999 */
\`\`\`
`);
    expect(gaps(d).map((c) => c.text)).toEqual(['start']);
  });

  test('unbound.member in a comment outside the type section still gaps', () => {
    const d = doc(`# Server

## LivelyServer

Serves rooms.

## Other

\`\`\`ts
const other = make();
// other.port → 1999
\`\`\`
`);
    expect(
      gaps(d)
        .map((c) => c.text)
        .sort(),
    ).toEqual(['port', 'start']);
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

function guideSpec(): ApiSpec {
  return {
    meta: { name: PKG },
    exports: [
      {
        id: 'useOthers',
        name: 'useOthers',
        kind: 'function',
        signatures: [{ returns: { schema: { $ref: '#/types/Map' } } }],
      },
      {
        id: 'useStorage',
        name: 'useStorage',
        kind: 'function',
      },
      {
        id: 'Room',
        name: 'Room',
        kind: 'class',
        members: [
          { name: 'getStorage', kind: 'method' },
          { name: 'subscribe', kind: 'method' },
        ],
      },
      { id: 'atom', name: 'atom', kind: 'function' },
      {
        id: 'LivelyClient',
        name: 'LivelyClient',
        kind: 'class',
        members: [
          {
            name: 'joinRoom',
            kind: 'method',
            signatures: [
              {
                parameters: [
                  { name: 'roomId', required: true, schema: { type: 'string' } },
                  { name: 'options', required: false, schema: { type: 'object' } },
                ],
              },
            ],
          },
          { name: 'leaveRoom', kind: 'method' },
          { name: 'getRoom', kind: 'method' },
        ],
      },
      {
        id: 'LivelyProvider',
        name: 'LivelyProvider',
        kind: 'function',
        signatures: [
          {
            parameters: [
              {
                name: 'props',
                required: true,
                schema: {
                  type: 'object',
                  properties: {
                    client: { type: 'object' },
                    children: { type: 'object' },
                  },
                  required: ['client'],
                },
              },
            ],
          },
        ],
      },
      {
        id: 'RoomProvider',
        name: 'RoomProvider',
        kind: 'function',
        signatures: [
          {
            parameters: [
              {
                name: 'props',
                required: true,
                schema: {
                  type: 'object',
                  properties: {
                    roomId: { type: 'string' },
                    userId: { type: 'string' },
                    displayName: { type: 'string' },
                    children: { type: 'object' },
                  },
                  required: ['roomId', 'userId', 'displayName'],
                },
              },
            ],
          },
        ],
      },
      {
        id: 'useMutation',
        name: 'useMutation',
        kind: 'function',
        signatures: [
          {
            parameters: [
              { name: 'callback', required: true, schema: { type: 'function' } },
              { name: 'deps', required: true, schema: { type: 'array' } },
            ],
          },
        ],
      },
      {
        id: 'createRoomContext',
        name: 'createRoomContext',
        kind: 'function',
        signatures: [
          {
            typeParameters: [{ name: 'TPresence' }, { name: 'TStorage' }],
            parameters: [],
          },
        ],
      },
      {
        id: 'createClient',
        name: 'createClient',
        kind: 'function',
        signatures: [
          {
            parameters: [
              {
                name: 'options',
                required: false,
                schema: {
                  type: 'object',
                  properties: { host: { type: 'string' } },
                  required: [],
                },
              },
            ],
          },
          {
            parameters: [
              { name: 'host', required: true, schema: { type: 'string' } },
              { name: 'port', required: true, schema: { type: 'number' } },
            ],
          },
        ],
      },
    ],
  };
}

function guidePage(file: string, content: string, map?: { page: string; type: string }[]) {
  const spec = guideSpec();
  return buildPageDocument({
    spec,
    registry: buildExportRegistry(spec),
    file,
    content,
    packageName: spec.meta.name,
    ...(map ? { docsMap: { pages: map } } : {}),
  });
}

describe('prose candidates from guide sentences', () => {
  test('sentence naming a backticked hook is a prose candidate spanning the sentence', () => {
    const content =
      '# Quick Start\n\n`useOthers()` returns a Map of users keyed by connection id.\n';
    const doc = guidePage('docs/guides/quick-start.md', content);
    const prose = doc.claims.filter((c) => c.kind === 'prose');
    expect(prose).toHaveLength(1);
    expect(prose[0].text).toBe('`useOthers()` returns a Map of users keyed by connection id.');
    expect(prose[0].specRef?.export).toBe('useOthers');
    expect(prose[0].candidate).toBe(true);
    expect(prose[0].rule).toBeUndefined();
    expect(prose[0].locator.start.line).toBe(3);
    expect(prose[0].locator.start.col).toBe(1);
    expect(prose[0].locator.end.line).toBe(3);
  });

  test('sentence with no export name emits nothing a judge can read', () => {
    const doc = guidePage(
      'docs/guides/quick-start.md',
      '# Quick Start\n\nThe client reconnects automatically.\n',
    );
    expect(doc.claims.filter((c) => c.kind === 'prose')).toEqual([]);
  });

  test('bare camelCase export matches; dictionary-plain Room and atom need backticks', () => {
    const content = `# Guide

useStorage reads the CRDT root. Room is the handle. atom is a jotai primitive.
`;
    const doc = guidePage('docs/guides/quick-start.md', content);
    const prose = doc.claims.filter((c) => c.kind === 'prose');
    expect(prose.map((c) => c.specRef?.export).sort()).toEqual(['useStorage']);
    expect(prose[0].text).toBe('useStorage reads the CRDT root.');

    const ticked = guidePage(
      'docs/guides/quick-start.md',
      '# Guide\n\n`Room` is the handle and `atom` creates state.\n',
    );
    expect(
      ticked.claims
        .filter((c) => c.kind === 'prose')
        .map((c) => c.specRef?.export)
        .sort(),
    ).toEqual(['Room', 'atom']);
  });

  test('bare PascalCase with 2+ humps matches; headings and import lines are skipped', () => {
    const content = `# LivelyClient

import { useOthers } from '@waits/lively-react'

LivelyClient talks to the server.
`;
    const doc = guidePage('docs/api/client.md', content);
    expect(
      doc.claims
        .filter((c) => c.kind === 'heading')
        .some((c) => c.specRef?.export === 'LivelyClient'),
    ).toBe(true);
    const prose = doc.claims.filter((c) => c.kind === 'prose');
    expect(prose).toHaveLength(1);
    expect(prose[0].specRef?.export).toBe('LivelyClient');
    expect(prose[0].text).toBe('LivelyClient talks to the server.');
    expect(prose.some((c) => c.text.includes('import'))).toBe(false);
  });

  test('list item and table cell each emit a prose candidate', () => {
    const content = `# Guide

- useStorage holds the CRDT root

| Hook | Note |
| --- | --- |
| x | useOthers returns presence |
`;
    const doc = guidePage('docs/guides/quick-start.md', content);
    const prose = doc.claims.filter((c) => c.kind === 'prose');
    expect(prose.map((c) => c.specRef?.export).sort()).toEqual(['useOthers', 'useStorage']);
    expect(prose.find((c) => c.specRef?.export === 'useStorage')?.text).toBe(
      'useStorage holds the CRDT root',
    );
    expect(prose.find((c) => c.specRef?.export === 'useOthers')?.text).toBe(
      'useOthers returns presence',
    );
  });

  test('Type.member in a sentence is one claim; two exports in one sentence are two claims', () => {
    const content = '# Guide\n\nuseStorage and Room.getStorage both read the tree.\n';
    const doc = guidePage('docs/guides/quick-start.md', content);
    const prose = doc.claims.filter((c) => c.kind === 'prose');
    expect(prose).toHaveLength(2);
    expect(
      prose.every((c) => c.text === 'useStorage and Room.getStorage both read the tree.'),
    ).toBe(true);
    expect(
      prose
        .map((c) =>
          c.specRef?.member ? `${c.specRef.export}.${c.specRef.member}` : c.specRef?.export,
        )
        .sort(),
    ).toEqual(['Room.getStorage', 'useStorage']);
  });

  test('fenced import lines are not prose', () => {
    const content = `# Guide

\`\`\`ts
import { useOthers } from '@waits/lively-react'
\`\`\`

the client reconnects automatically
`;
    const doc = guidePage('docs/guides/quick-start.md', content);
    expect(doc.claims.filter((c) => c.kind === 'prose')).toEqual([]);
  });
});

describe('gap accuracy: cross-fence bindings and heading-scoped members', () => {
  test('joinRoom in a later fence counts when client was bound with new LivelyClient earlier', () => {
    const content = `# Client

## LivelyClient

\`\`\`ts
const client = new LivelyClient({ server: 'wss://example' });
\`\`\`

Then connect:

\`\`\`ts
client.joinRoom('room-1', {});
\`\`\`
`;
    const doc = guidePage('docs/client.md', content);
    expect(
      gaps(doc)
        .map((c) => c.text)
        .sort(),
    ).toEqual(['getRoom', 'leaveRoom']);
  });

  test('backticked member(...) under a type heading counts as T.member', () => {
    const content = `# Client

## LivelyClient

Call \`joinRoom(roomId, options)\` to enter.
`;
    const doc = guidePage('docs/client.md', content);
    expect(
      gaps(doc)
        .map((c) => c.text)
        .sort(),
    ).toEqual(['getRoom', 'leaveRoom']);
    const mention = doc.claims.find(
      (c) =>
        c.specRef?.export === 'LivelyClient' &&
        c.specRef?.member === 'joinRoom' &&
        c.kind !== 'gap',
    );
    expect(mention).toBeDefined();
  });
});

describe('call-site rules (unknown key, arity, missing required)', () => {
  test('JSX unknown prop on a resolved component', () => {
    const content = `# Quick Start

\`\`\`tsx
<LivelyProvider serverUrl="wss://example">
  {children}
</LivelyProvider>
\`\`\`
`;
    const doc = guidePage('docs/guides/quick-start.md', content);
    const hit = doc.claims.find((c) => c.rule?.type === 'prose-unknown-key');
    expect(hit).toBeDefined();
    expect(hit?.candidate).toBe(false);
    expect(hit?.specRef?.export).toBe('LivelyProvider');
    expect(hit?.rule?.issue).toContain('serverUrl');
  });

  test('missing required JSX props', () => {
    const content = `# Quick Start

\`\`\`tsx
<RoomProvider roomId="my-room">{children}</RoomProvider>
\`\`\`
`;
    const doc = guidePage('docs/guides/quick-start.md', content);
    const hit = doc.claims.find((c) => c.rule?.type === 'prose-missing-required');
    expect(hit).toBeDefined();
    expect(hit?.specRef?.export).toBe('RoomProvider');
    expect(hit?.rule?.issue).toContain('userId');
    expect(hit?.rule?.issue).toContain('displayName');
    expect(hit?.rule?.issue).not.toContain('roomId');
  });

  test('missing required positional argument', () => {
    const content = `# Mutations

\`\`\`ts
useMutation(callback)
\`\`\`
`;
    const doc = guidePage('docs/guides/mutations.md', content);
    const hit = doc.claims.find((c) => c.rule?.type === 'prose-missing-required');
    expect(hit).toBeDefined();
    expect(hit?.specRef?.export).toBe('useMutation');
    expect(hit?.rule?.issue).toContain('deps');
  });

  test('more positional args than any overload', () => {
    const content = `# Client

\`\`\`ts
createClient('localhost', 8080, 'extra')
\`\`\`
`;
    const doc = guidePage('docs/guides/client.md', content);
    const hit = doc.claims.find((c) => c.rule?.type === 'prose-arity-mismatch');
    expect(hit).toBeDefined();
    expect(hit?.specRef?.export).toBe('createClient');
  });

  test('type arguments are not arguments', () => {
    const content = `# Context

\`\`\`ts
createRoomContext<TPresence, TStorage>()
\`\`\`
`;
    const doc = guidePage('docs/guides/context.md', content);
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-arity-mismatch')).toEqual([]);
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-missing-required')).toEqual([]);
  });

  test('JSX on an export with no props shape is not unknown-key', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'Bare',
          name: 'Bare',
          kind: 'function',
          signatures: [{ parameters: [] }],
        },
      ],
    };
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/bare.md',
      content: '# Bare\n\n```tsx\n<Bare foo="x" />\n```\n',
      packageName: PKG,
    });
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-unknown-key')).toEqual([]);
  });

  test('unknown receiver is not a claim', () => {
    const content = `# Guide

\`\`\`ts
db.query({ foo: 1 })
jwt.sign(payload)
\`\`\`
`;
    const doc = guidePage('docs/guides/server.md', content);
    expect(doc.claims.filter((c) => c.rule)).toEqual([]);
  });

  test('object-literal option key not on the parameter type', () => {
    const content = `# Client

\`\`\`ts
createClient({ host: 'x', token: 'nope' })
\`\`\`
`;
    const doc = guidePage('docs/guides/client.md', content);
    const hit = doc.claims.find((c) => c.rule?.type === 'prose-unknown-key');
    expect(hit).toBeDefined();
    expect(hit?.rule?.issue).toContain('token');
  });

  test('JSX children satisfy a required children prop', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'Box',
          name: 'Box',
          kind: 'function',
          signatures: [
            {
              parameters: [
                {
                  name: 'props',
                  required: true,
                  schema: {
                    type: 'object',
                    properties: { children: { type: 'object' } },
                    required: ['children'],
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const missing = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/box.md',
      content: '# Box\n\n```tsx\n<Box />\n```\n',
      packageName: PKG,
    });
    expect(
      missing.claims.find((c) => c.rule?.type === 'prose-missing-required')?.rule?.issue,
    ).toContain('children');
    const ok = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/box.md',
      content: '# Box\n\n```tsx\n<Box>inside</Box>\n```\n',
      packageName: PKG,
    });
    expect(ok.claims.filter((c) => c.rule?.type === 'prose-missing-required')).toEqual([]);
  });

  test('required in only one overload does not fire missing-required', () => {
    const content = `# Client

\`\`\`ts
createClient({ host: 'x' })
\`\`\`
`;
    const doc = guidePage('docs/guides/client.md', content);
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-missing-required')).toEqual([]);
  });

  test('spread argument skips missing-required', () => {
    const content = `# Mutations

\`\`\`ts
useMutation(...args)
\`\`\`
`;
    const doc = guidePage('docs/guides/mutations.md', content);
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-missing-required')).toEqual([]);
  });

  test('new C({ foo }) unknown key when foo is not on the constructor param type', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'LivelyClient',
          name: 'LivelyClient',
          kind: 'class',
          signatures: [
            {
              parameters: [
                {
                  name: 'options',
                  required: false,
                  schema: {
                    type: 'object',
                    properties: { server: { type: 'string' } },
                    required: [],
                  },
                },
              ],
            },
          ],
          members: [{ name: 'joinRoom', kind: 'method' }],
        },
      ],
    };
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/client.md',
      content: '# C\n\n```ts\nnew LivelyClient({ token: "x" })\n```\n',
      packageName: PKG,
    });
    const hit = doc.claims.find((c) => c.rule?.type === 'prose-unknown-key');
    expect(hit).toBeDefined();
    expect(hit?.rule?.issue).toContain('token');
  });
});

describe('call-site: object-literal keys match the parameter type at that position', () => {
  test('Partial<T> constructor arg is not unknown-key (LiveObject initial)', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'LiveObject',
          name: 'LiveObject',
          kind: 'class',
          typeParameters: [{ name: 'T' }],
          signatures: [
            {
              parameters: [
                {
                  name: 'initial',
                  required: false,
                  schema: {
                    type: 'object',
                    'x-ts-type': 'Partial',
                    'x-ts-type-arguments': [{ 'x-ts-type': 'T' }],
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/storage.md',
      content:
        '# Storage\n\n```ts\nnew LiveObject({ name, avatar, role: "viewer", joinedAt: Date.now() })\n```\n',
      packageName: PKG,
    });
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-unknown-key')).toEqual([]);
  });

  test('type-parameter initialValue is not unknown-key (useLiveState)', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'useLiveState',
          name: 'useLiveState',
          kind: 'function',
          typeParameters: [{ name: 'T' }],
          signatures: [
            {
              parameters: [
                { name: 'key', required: true, schema: { type: 'string' } },
                { name: 'initialValue', required: true, schema: { 'x-ts-type': 'T' } },
                {
                  name: 'opts',
                  required: false,
                  schema: {
                    type: 'object',
                    properties: { syncDuration: { type: 'number' } },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/hooks/use-live-state.md',
      content: '# Hook\n\n```ts\nuseLiveState("mousePos", { x: 0, y: 0 })\n```\n',
      packageName: PKG,
    });
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-unknown-key')).toEqual([]);
  });

  test('type-parameter value arg is not unknown-key (LiveMap.set)', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'LiveMap',
          name: 'LiveMap',
          kind: 'class',
          typeParameters: [{ name: 'V' }],
          members: [
            {
              name: 'set',
              kind: 'method',
              signatures: [
                {
                  parameters: [
                    { name: 'key', required: true, schema: { type: 'string' } },
                    { name: 'value', required: true, schema: { 'x-ts-type': 'V' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/storage.md',
      content:
        '# Map\n\n```ts\nconst map = new LiveMap();\nmap.set("carol", { score: 30 });\n```\n',
      packageName: PKG,
    });
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-unknown-key')).toEqual([]);
  });

  test('closed options object still fires when a key is not on that type', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'buildPage',
          name: 'buildPage',
          kind: 'function',
          signatures: [
            {
              parameters: [
                {
                  name: 'options',
                  required: true,
                  schema: {
                    type: 'object',
                    properties: {
                      registry: { type: 'object' },
                      file: { type: 'string' },
                      content: { type: 'string' },
                    },
                    required: ['registry', 'file', 'content'],
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/page.md',
      content: '# Page\n\n```ts\nbuildPage({ spec, registry, file, content })\n```\n',
      packageName: PKG,
    });
    const hit = doc.claims.find((c) => c.rule?.type === 'prose-unknown-key');
    expect(hit).toBeDefined();
    expect(hit?.rule?.issue).toContain('spec');
    expect(hit?.rule?.suggestion).toContain('registry');
    expect(hit?.rule?.suggestion).not.toContain('options');
  });
});

describe('call-site: JSX props are the component top-level props', () => {
  function providerSpec(): ApiSpec {
    return {
      meta: { name: PKG },
      exports: [
        {
          id: 'LivelyClient',
          name: 'LivelyClient',
          kind: 'class',
          schema: {
            type: 'object',
            properties: {
              config: { type: 'object' },
              rooms: { type: 'object' },
              joinRoom: { type: 'function' },
              leaveRoom: { type: 'function' },
              getRoom: { type: 'function' },
              getRooms: { type: 'function' },
            },
            required: ['config', 'rooms', 'joinRoom', 'leaveRoom', 'getRoom', 'getRooms'],
          },
          members: [
            { name: 'config', kind: 'property' },
            { name: 'rooms', kind: 'property' },
            { name: 'joinRoom', kind: 'method' },
            { name: 'leaveRoom', kind: 'method' },
            { name: 'getRoom', kind: 'method' },
            { name: 'getRooms', kind: 'method' },
          ],
        },
        {
          id: 'LivelyProvider',
          name: 'LivelyProvider',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'client', required: true, schema: { $ref: '#/types/LivelyClient' } },
                { name: 'children', required: true, schema: { type: 'object' } },
              ],
            },
          ],
        },
        {
          id: 'RoomProvider',
          name: 'RoomProvider',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'roomId', required: true, schema: { type: 'string' } },
                { name: 'userId', required: true, schema: { type: 'string' } },
                { name: 'displayName', required: true, schema: { type: 'string' } },
                { name: 'children', required: true, schema: { type: 'object' } },
              ],
            },
          ],
        },
      ],
      types: [
        {
          id: 'LivelyClient',
          name: 'LivelyClient',
          kind: 'class',
          schema: {
            type: 'object',
            properties: {
              config: { type: 'object' },
              rooms: { type: 'object' },
              joinRoom: { type: 'function' },
              leaveRoom: { type: 'function' },
              getRoom: { type: 'function' },
              getRooms: { type: 'function' },
            },
            required: ['config', 'rooms', 'joinRoom', 'leaveRoom', 'getRoom', 'getRooms'],
          },
          members: [
            { name: 'config', kind: 'property' },
            { name: 'rooms', kind: 'property' },
            { name: 'joinRoom', kind: 'method' },
            { name: 'leaveRoom', kind: 'method' },
            { name: 'getRoom', kind: 'method' },
            { name: 'getRooms', kind: 'method' },
          ],
        },
      ],
    };
  }

  test('does not flatten LivelyClient members into LivelyProvider props', () => {
    const spec = providerSpec();
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/guides/quick-start.md',
      content: `# Quick Start

\`\`\`tsx
<LivelyProvider client={client}>
  <App />
</LivelyProvider>
\`\`\`
`,
      packageName: PKG,
    });
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-missing-required')).toEqual([]);
    const unknown = doc.claims.filter((c) => c.rule?.type === 'prose-unknown-key');
    expect(unknown).toEqual([]);
  });

  test('unknown JSX prop Allowed lists top-level props only', () => {
    const spec = providerSpec();
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/guides/quick-start.md',
      content: `# Quick Start

\`\`\`tsx
<LivelyProvider serverUrl="ws://localhost:1999">
  <App />
</LivelyProvider>
\`\`\`
`,
      packageName: PKG,
    });
    const hit = doc.claims.find((c) => c.rule?.type === 'prose-unknown-key');
    expect(hit?.rule?.issue).toContain('serverUrl');
    expect(hit?.rule?.suggestion).toBe('Allowed: children, client');
    expect(hit?.rule?.suggestion).not.toContain('joinRoom');
  });

  test('nested JSX element missing required props is a claim', () => {
    const spec = providerSpec();
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/guides/quick-start.md',
      content: `# Quick Start

\`\`\`tsx
<LivelyProvider serverUrl="ws://localhost:1999">
  <RoomProvider roomId="my-room">
    <YourApp />
  </RoomProvider>
</LivelyProvider>
\`\`\`
`,
      packageName: PKG,
    });
    const missing = doc.claims.filter((c) => c.rule?.type === 'prose-missing-required');
    const room = missing.find((c) => c.specRef?.export === 'RoomProvider');
    expect(room).toBeDefined();
    expect(room?.rule?.issue).toContain('userId');
    expect(room?.rule?.issue).toContain('displayName');
    expect(room?.rule?.issue).not.toContain('roomId');
    const outer = doc.claims.find(
      (c) => c.rule?.type === 'prose-unknown-key' && c.specRef?.export === 'LivelyProvider',
    );
    expect(outer?.rule?.issue).toContain('serverUrl');
  });
});

describe('gap: call-return bindings and heading-scoped fence members', () => {
  function clientRoomSpec(): ApiSpec {
    return {
      meta: { name: PKG },
      exports: [
        {
          id: 'Room',
          name: 'Room',
          kind: 'class',
          members: [
            { name: 'getStatus', kind: 'method' },
            { name: 'followUser', kind: 'method' },
            { name: 'getOthers', kind: 'method' },
            { name: 'batch', kind: 'method' },
            { name: 'subscribe', kind: 'method' },
          ],
        },
        {
          id: 'LivelyClient',
          name: 'LivelyClient',
          kind: 'class',
          members: [
            {
              name: 'joinRoom',
              kind: 'method',
              signatures: [
                {
                  parameters: [
                    { name: 'roomId', required: true, schema: { type: 'string' } },
                    { name: 'options', required: false, schema: { type: 'object' } },
                  ],
                  returns: { schema: { $ref: '#/types/Room' } },
                },
              ],
            },
            { name: 'leaveRoom', kind: 'method' },
          ],
        },
      ],
    };
  }

  test('const room = client.joinRoom() counts Room.member calls as mentioned', () => {
    const spec = clientRoomSpec();
    const content = `# Client

## Room

\`\`\`ts
const client = new LivelyClient();
const room = client.joinRoom("room-1", { userId: "a", displayName: "A" });
room.getStatus();
room.followUser("user-456");
room.getOthers();
room.batch(() => {});
room.subscribe(() => {});
\`\`\`
`;
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/client.md',
      content,
      packageName: PKG,
    });
    expect(
      gaps(doc)
        .map((c) => c.text)
        .sort(),
    ).toEqual([]);
  });

  test('joinRoom in a later fence still binds room to Room', () => {
    const spec = clientRoomSpec();
    const content = `# Client

## LivelyClient

\`\`\`ts
const client = new LivelyClient();
\`\`\`

Then:

\`\`\`ts
const room = client.joinRoom("room-1", { userId: "a", displayName: "A" });
room.getStatus();
room.subscribe(() => {});
\`\`\`

## Room
`;
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/client.md',
      content,
      packageName: PKG,
    });
    expect(
      gaps(doc)
        .map((c) => c.text)
        .sort(),
    ).toEqual(['batch', 'followUser', 'getOthers', 'leaveRoom']);
  });

  test('under ## Room, x.member() counts as Room.member with no binding', () => {
    const spec = clientRoomSpec();
    const content = `# Client

## Room

\`\`\`ts
room.getStatus();
room.followUser("user-456");
\`\`\`
`;
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/client.md',
      content,
      packageName: PKG,
    });
    expect(
      gaps(doc)
        .map((c) => c.text)
        .sort(),
    ).toEqual(['batch', 'getOthers', 'subscribe']);
  });
});

describe('ambiguous bare members resolve via heading ancestors', () => {
  function crdtSpec(): ApiSpec {
    return {
      meta: { name: PKG },
      exports: [
        {
          id: 'LiveObject',
          name: 'LiveObject',
          kind: 'class',
          signatures: [
            {
              parameters: [
                {
                  name: 'initial',
                  required: false,
                  schema: {
                    type: 'object',
                    properties: { seed: { type: 'number' } },
                  },
                },
              ],
            },
          ],
          members: [
            {
              name: 'toImmutable',
              kind: 'method',
              signatures: [{ returns: { schema: { type: 'object' } } }],
            },
            { name: 'get', kind: 'method' },
          ],
        },
        {
          id: 'LiveMap',
          name: 'LiveMap',
          kind: 'class',
          members: [
            {
              name: 'toImmutable',
              kind: 'method',
              signatures: [{ returns: { schema: { type: 'object' } } }],
            },
          ],
        },
        {
          id: 'LiveList',
          name: 'LiveList',
          kind: 'class',
          members: [
            { name: 'toArray', kind: 'method' },
            {
              name: 'toImmutable',
              kind: 'method',
              signatures: [{ returns: { schema: { type: 'array' } } }],
            },
          ],
        },
      ],
    };
  }

  test('toImmutable under ## LiveList is LiveList.toImmutable, not LiveObject', () => {
    const spec = crdtSpec();
    const content = `# Storage

## LiveObject

\`\`\`ts
const obj = new LiveObject({ a: 1 });
obj.toImmutable();
\`\`\`

\`get()\` reads a field. \`toImmutable()\` freezes the object.

## LiveList

#### Methods

\`toArray()\` - snapshot as plain array. \`toImmutable()\` - frozen \`readonly T[]\`
`;
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/storage.md',
      content,
      packageName: PKG,
    });
    const listImm = doc.claims.filter(
      (c) =>
        c.kind !== 'gap' && c.specRef?.export === 'LiveList' && c.specRef?.member === 'toImmutable',
    );
    expect(listImm.length).toBeGreaterThan(0);
    const underList = doc.claims.filter(
      (c) =>
        c.kind !== 'gap' &&
        c.specRef?.member === 'toImmutable' &&
        (c.locator.headingText === 'LiveList' || c.locator.headingText === 'Methods'),
    );
    expect(underList.every((c) => c.specRef?.export === 'LiveList')).toBe(true);
    expect(underList.some((c) => c.specRef?.export === 'LiveObject')).toBe(false);
  });

  test('table row under #### Methods in a LiveList section is LiveList.toImmutable', () => {
    const spec = crdtSpec();
    const content = `# useStorage

## LiveObject

\`\`\`ts
new LiveObject({ a: 1 })
\`\`\`

## LiveList

#### Methods

| Method | Returns |
| --- | --- |
| \`toImmutable()\` | \`readonly T[]\` |
`;
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/hooks/use-storage.md',
      content,
      packageName: PKG,
    });
    const hits = doc.claims.filter((c) => c.kind !== 'gap' && c.specRef?.member === 'toImmutable');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((c) => c.specRef?.export === 'LiveList')).toBe(true);
  });

  test('ambiguous member with no type heading emits no specRef', () => {
    const spec = crdtSpec();
    const content = `# Storage

See \`toImmutable()\` for a snapshot.
`;
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/storage.md',
      content,
      packageName: PKG,
    });
    expect(
      doc.claims.filter((c) => c.kind !== 'gap' && c.specRef?.member === 'toImmutable'),
    ).toEqual([]);
  });
});

describe('signature fence is not a call (prose-arity-mismatch)', () => {
  function middlewareSpec(): ApiSpec {
    return {
      meta: { name: PKG },
      exports: [
        {
          id: 'combine',
          name: 'combine',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'initialState', required: true, schema: { type: 'object' } },
                { name: 'additionalStateCreatorFn', required: true, schema: { type: 'function' } },
              ],
            },
          ],
        },
        {
          id: 'devtools',
          name: 'devtools',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'stateCreatorFn', required: true, schema: { type: 'function' } },
                { name: 'devtoolsOptions', required: false, schema: { type: 'object' } },
              ],
            },
          ],
        },
        {
          id: 'redux',
          name: 'redux',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'reducer', required: true, schema: { type: 'function' } },
                { name: 'initialState', required: true, schema: { type: 'object' } },
              ],
            },
          ],
        },
        {
          id: 'subscribeWithSelector',
          name: 'subscribeWithSelector',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'stateCreatorFn', required: true, schema: { type: 'function' } },
              ],
            },
          ],
        },
        {
          id: 'useAtomCallback',
          name: 'useAtomCallback',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'callback', required: true, schema: { type: 'function' } },
                { name: 'options', required: false, schema: { type: 'object' } },
              ],
            },
          ],
        },
      ],
    };
  }

  function doc(content: string) {
    const spec = middlewareSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/middleware.md',
      content,
      packageName: PKG,
    });
  }

  test('reference signature with name: Type params and return type is not arity-mismatch', () => {
    const content = `# Middleware

\`\`\`ts
combine<T extends object, U extends object>(initialState: T, additionalStateCreatorFn: StateCreator<T, [], [], U>): StateCreator<Omit<T, keyof U> & U, [], []>
devtools<T>(stateCreatorFn: StateCreator<T, [], []>, devtoolsOptions?: DevtoolsOptions): StateCreator<T, [['zustand/devtools', never]]>
redux<T, A extends { type: string }>(reducer: (state: T, action: A) => T, initialState: T): StateCreator<T, [], []>
subscribeWithSelector<T>(stateCreatorFn: StateCreator<T, [], []>): StateCreator<T, [], []>
useAtomCallback<Result, Args extends unknown[]>(callback: (get: Getter, set: Setter, ...args: Args) => Result): (...args: Args) => Result
\`\`\`
`;
    const d = doc(content);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-arity-mismatch')).toEqual([]);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-missing-required')).toEqual([]);
  });

  test('real extra positional args still fire', () => {
    const content = `# Middleware

\`\`\`ts
combine(state, fn, extra)
\`\`\`
`;
    const hit = doc(content).claims.find((c) => c.rule?.type === 'prose-arity-mismatch');
    expect(hit).toBeDefined();
    expect(hit?.specRef?.export).toBe('combine');
  });
});

describe('prose-unknown-key on intersection and extended option types', () => {
  test('intersection arm keys are allowed (valtio Options & Config)', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'devtools',
          name: 'devtools',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'state', required: true, schema: { type: 'object' } },
                { name: 'options', required: false, schema: { $ref: '#/types/Options' } },
              ],
            },
          ],
        },
      ],
      types: [
        {
          id: 'Options',
          name: 'Options',
          kind: 'type',
          schema: {
            allOf: [
              {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  name: { type: 'string' },
                },
              },
              { $ref: '#/types/Config' },
            ],
          },
          members: [
            { name: 'enabled', kind: 'property' },
            { name: 'name', kind: 'property' },
          ],
        },
        {
          id: 'Config',
          name: 'Config',
          kind: 'interface',
          schema: {
            type: 'object',
            properties: { serialize: { type: 'boolean' } },
          },
        },
      ],
    };
    const d = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/utils.md',
      content: '# Utils\n\n```ts\ndevtools(state, { name: "state name", enabled: true })\n```\n',
      packageName: PKG,
    });
    expect(d.claims.filter((c) => c.rule?.type === 'prose-unknown-key')).toEqual([]);
  });

  test('unresolved intersection arm makes the shape open', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'devtools',
          name: 'devtools',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'state', required: true, schema: { type: 'object' } },
                { name: 'options', required: false, schema: { $ref: '#/types/Options' } },
              ],
            },
          ],
        },
      ],
      types: [
        {
          id: 'Options',
          name: 'Options',
          kind: 'type',
          schema: {
            allOf: [
              {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  name: { type: 'string' },
                },
              },
              { $ref: '#/types/Config' },
            ],
          },
        },
      ],
    };
    const d = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/utils.md',
      content: '# Utils\n\n```ts\ndevtools(state, { name: "x", notAKey: true })\n```\n',
      packageName: PKG,
    });
    expect(d.claims.filter((c) => c.rule?.type === 'prose-unknown-key')).toEqual([]);
  });

  test('interface own keys plus closed extends are unioned', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'devtools',
          name: 'devtools',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'fn', required: true, schema: { type: 'function' } },
                { name: 'options', required: false, schema: { $ref: '#/types/DevtoolsOptions' } },
              ],
            },
          ],
        },
      ],
      types: [
        {
          id: 'DevtoolsOptions',
          name: 'DevtoolsOptions',
          kind: 'interface',
          extends: 'Config',
          schema: {
            type: 'object',
            properties: { actionsDenylist: { type: 'string' } },
          },
          members: [{ name: 'actionsDenylist', kind: 'property' }],
        },
        {
          id: 'Config',
          name: 'Config',
          kind: 'interface',
          schema: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      ],
    };
    const ok = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/middleware.md',
      content:
        '# Middleware\n\n```ts\ndevtools(fn, { name: "store", actionsDenylist: "inc" })\n```\n',
      packageName: PKG,
    });
    expect(ok.claims.filter((c) => c.rule?.type === 'prose-unknown-key')).toEqual([]);
    const bad = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/middleware.md',
      content: '# Middleware\n\n```ts\ndevtools(fn, { notAKey: true })\n```\n',
      packageName: PKG,
    });
    const hit = bad.claims.find((c) => c.rule?.type === 'prose-unknown-key');
    expect(hit?.rule?.issue).toContain('notAKey');
  });

  test('external or unresolved extends makes the shape open (zustand Config)', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'devtools',
          name: 'devtools',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'fn', required: true, schema: { type: 'function' } },
                { name: 'options', required: false, schema: { $ref: '#/types/DevtoolsOptions' } },
              ],
            },
          ],
        },
      ],
      types: [
        {
          id: 'DevtoolsOptions',
          name: 'DevtoolsOptions',
          kind: 'interface',
          extends: 'Config',
          schema: {
            allOf: [{ $ref: '#/types/Config' }],
            type: 'object',
            properties: { actionsDenylist: { type: 'string' } },
          },
          members: [{ name: 'actionsDenylist', kind: 'property' }],
        },
        {
          id: 'Config',
          name: 'Config',
          kind: 'type',
          source: { package: '@redux-devtools/extension', file: '<external>' },
          schema: {
            type: 'object',
            properties: { serialize: { type: 'boolean' } },
          },
        },
      ],
    };
    const d = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/middleware.md',
      content:
        '# Middleware\n\n```ts\ndevtools(fn, { actionsDenylist: ["inc"], notAKey: true })\n```\n',
      packageName: PKG,
    });
    expect(d.claims.filter((c) => c.rule?.type === 'prose-unknown-key')).toEqual([]);
  });
});

describe('elided argument lists are not missing-required', () => {
  test('useMutation(/* ... */) is an elision', () => {
    const content = `# Mutations

\`\`\`ts
const deleteShape = useMutation(/* ... */);
\`\`\`
`;
    const doc = guidePage('docs/guides/mutations.md', content);
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-missing-required')).toEqual([]);
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-arity-mismatch')).toEqual([]);
  });

  test('useMutation(...) is an elision', () => {
    const content = `# Mutations

\`\`\`ts
useMutation(...)
\`\`\`
`;
    const doc = guidePage('docs/guides/mutations.md', content);
    expect(doc.claims.filter((c) => c.rule?.type === 'prose-missing-required')).toEqual([]);
  });

  test('empty parens still missing-required; one real arg still missing deps', () => {
    const empty = guidePage(
      'docs/guides/mutations.md',
      '# Mutations\n\n```ts\nconst run = useMutation()\n```\n',
    );
    expect(
      empty.claims.find((c) => c.rule?.type === 'prose-missing-required')?.rule?.issue,
    ).toContain('callback');
    const one = guidePage(
      'docs/guides/mutations.md',
      '# Mutations\n\n```ts\nuseMutation(cb)\n```\n',
    );
    expect(
      one.claims.find((c) => c.rule?.type === 'prose-missing-required')?.rule?.issue,
    ).toContain('deps');
  });
});

describe('backticked .member() under a type heading counts as T.member', () => {
  test('exposes `.start()` / `.stop()` covers LivelyServer.stop', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'LivelyServer',
          name: 'LivelyServer',
          kind: 'class',
          members: [
            { name: 'start', kind: 'method' },
            { name: 'stop', kind: 'method' },
            { name: 'restart', kind: 'method' },
          ],
        },
      ],
    };
    const d = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/server.md',
      content: `# Server

## LivelyServer

exposes \`.start()\` / \`.stop()\`
`,
      packageName: PKG,
    });
    expect(
      gaps(d)
        .map((c) => c.text)
        .sort(),
    ).toEqual(['restart']);
    const stop = d.claims.find(
      (c) =>
        c.kind !== 'gap' && c.specRef?.export === 'LivelyServer' && c.specRef?.member === 'stop',
    );
    expect(stop).toBeDefined();
  });
});

describe('prose-broken-reference scoped to the entry export path', () => {
  test('import from package root is silent when the spec is a subpath entry', () => {
    const spec: ApiSpec = {
      meta: { name: 'jotai' },
      exports: [{ id: 'atomFamily', name: 'atomFamily', kind: 'function' }],
    };
    const content = `# Utils

\`\`\`ts
import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'
\`\`\`
`;
    const d = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/utils.md',
      content,
      packageName: 'jotai',
      importSpecifier: 'jotai/utils',
    });
    const broken = d.claims.filter((c) => c.rule?.type === 'prose-broken-reference');
    expect(broken).toEqual([]);
  });

  test('import from the entry specifier still fires when the name is missing', () => {
    const spec: ApiSpec = {
      meta: { name: 'jotai' },
      exports: [{ id: 'atomFamily', name: 'atomFamily', kind: 'function' }],
    };
    const d = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/utils.md',
      content: "# Utils\n\n```ts\nimport { atom } from 'jotai/utils'\n```\n",
      packageName: 'jotai',
      importSpecifier: 'jotai/utils',
    });
    const hit = d.claims.find((c) => c.rule?.type === 'prose-broken-reference');
    expect(hit).toBeDefined();
    expect(hit?.rule?.issue).toContain('atom');
  });
});

function valibotSpec(): ApiSpec {
  return {
    meta: { name: 'valibot' },
    exports: [
      {
        id: 'lazy',
        name: 'lazy',
        kind: 'function',
        signatures: [
          { parameters: [{ name: 'getter', required: true, schema: { type: 'function' } }] },
        ],
      },
      { id: 'union', name: 'union', kind: 'function' },
      { id: 'string', name: 'string', kind: 'function' },
      { id: 'number', name: 'number', kind: 'function' },
      {
        id: 'size',
        name: 'size',
        kind: 'function',
        signatures: [
          {
            parameters: [
              { name: 'schema', required: true, schema: { type: 'object' } },
              { name: 'requirement', required: true, schema: { type: 'number' } },
            ],
          },
        ],
      },
      {
        id: 'value',
        name: 'value',
        kind: 'function',
        signatures: [
          {
            parameters: [{ name: 'requirement', required: true, schema: { type: 'string' } }],
            returns: { schema: { $ref: '#/types/ValueAction' } },
          },
        ],
      },
    ],
    types: [
      {
        id: 'Schema',
        name: 'Schema',
        kind: 'interface',
        members: [{ name: 'parse', kind: 'method' }],
      },
      {
        id: 'ValueAction',
        name: 'ValueAction',
        kind: 'interface',
        members: [{ name: 'pipe', kind: 'method' }],
      },
    ],
  };
}

function valibotPage(content: string, file = 'docs/lazy.md') {
  const spec = valibotSpec();
  return buildPageDocument({
    spec,
    registry: buildExportRegistry(spec),
    file,
    content,
    packageName: 'valibot',
  });
}

describe('namespace alias is not a missing export', () => {
  test('import * as v from the package is not prose-broken-reference', () => {
    const d = valibotPage(`# lazy

\`\`\`ts
import * as v from 'valibot'
const JsonSchema: v.GenericSchema<JsonData> = v.lazy(() =>
  v.union([v.string(), v.number()]),
);
\`\`\`
`);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-broken-reference')).toEqual([]);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-unresolved-member')).toEqual([]);
  });

  test('v.member in a later fence still uses the namespace binding', () => {
    const d = valibotPage(`# lazy

\`\`\`ts
import * as v from 'valibot'
\`\`\`

Then:

\`\`\`ts
v.lazy(() => v.string())
\`\`\`
`);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-broken-reference')).toEqual([]);
  });

  test('unknown ns.member is a broken reference against exports', () => {
    const d = valibotPage(`# lazy

\`\`\`ts
import * as v from 'valibot'
v.notAThing()
\`\`\`
`);
    const hit = d.claims.find((c) => c.rule?.type === 'prose-broken-reference');
    expect(hit).toBeDefined();
    expect(hit?.rule?.issue).toContain('notAThing');
    expect(hit?.rule?.issue).not.toMatch(/Import 'v'/);
  });

  test('short ident used as x.export( for many exports is a namespace even without an import', () => {
    const d = valibotPage(`# lazy

\`\`\`ts
const JsonSchema = v.lazy(() => v.union([v.string(), v.number()]));
\`\`\`
`);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-broken-reference')).toEqual([]);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-unresolved-member')).toEqual([]);
  });
});

describe('receivers and callees are not bound by name coincidence', () => {
  test('local Schema.decode is not unresolved-member on the Schema type', () => {
    const d = valibotPage(`# Migration

\`\`\`ts
// Change this
const Schema = t.type({ name: t.string });
const result = Schema.decode(input);
Schema.is(input);
Schema.validate(input);
\`\`\`
`);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-unresolved-member')).toEqual([]);
  });

  test('callback param value is not the value() export / ValueAction', () => {
    const d = valibotPage(`# Migration

\`\`\`ts
.Encode((value) => value.toISOString())
\`\`\`
`);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-unresolved-member')).toEqual([]);
  });

  test('bare size() in a foreign-import fence is not valibot size', () => {
    const d = valibotPage(`# Migration

\`\`\`ts
import { size, pattern, string } from 'superstruct'
size(pattern(string(), /^[a-z]+$/), 3, 30)
\`\`\`
`);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-arity-mismatch')).toEqual([]);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-missing-required')).toEqual([]);
  });

  test('bare size() under a Before heading is not a claim', () => {
    const d = valibotPage(`# Migration

## Before

\`\`\`ts
size(pattern(string(), /^[a-z]+$/), 3, 30)
\`\`\`
`);
    expect(d.claims.filter((c) => c.rule?.type === 'prose-arity-mismatch')).toEqual([]);
  });

  test('named import of size still fires arity', () => {
    const d = valibotPage(`# size

\`\`\`ts
import { size } from 'valibot'
size(schema, 3, 30)
\`\`\`
`);
    const hit = d.claims.find((c) => c.rule?.type === 'prose-arity-mismatch');
    expect(hit).toBeDefined();
    expect(hit?.specRef?.export).toBe('size');
  });

  test('new Schema() is still a binding', () => {
    const spec: ApiSpec = {
      meta: { name: 'valibot' },
      exports: [
        {
          id: 'Schema',
          name: 'Schema',
          kind: 'class',
          members: [{ name: 'parse', kind: 'method' }],
        },
      ],
    };
    const d = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/schema.md',
      content: `# Schema

\`\`\`ts
const Schema = new Schema();
Schema.decode(input);
\`\`\`
`,
      packageName: 'valibot',
    });
    expect(
      d.claims.filter((c) => c.rule?.type === 'prose-unresolved-member').map((c) => c.rule?.issue),
    ).toEqual(["Method 'decode' called on 'Schema' does not exist on 'Schema'"]);
  });
});

describe('buildPageDocuments forwards every option', () => {
  test('importSpecifier reaches each page (root import is silent on a subpath spec)', () => {
    const spec: ApiSpec = {
      meta: { name: 'pkg' },
      exports: [{ id: 'atomFamily', name: 'atomFamily', kind: 'function' }],
    };
    const content = '# x\n\n```ts\nimport { atom } from "pkg"\nconst a = atom(0)\n```\n';
    const [d] = buildPageDocuments({
      spec,
      registry: buildExportRegistry(spec),
      files: [{ file: 'docs/x.md', content }],
      importSpecifier: 'pkg/sub',
    });
    expect(d.claims.filter((c) => c.rule)).toEqual([]);
  });

  test('plural output equals singular output for the same options', () => {
    const spec: ApiSpec = {
      meta: { name: 'pkg' },
      exports: [{ id: 'atomFamily', name: 'atomFamily', kind: 'function' }],
    };
    const shared = {
      spec,
      registry: buildExportRegistry(spec),
      packageName: 'other',
      importSpecifier: 'other/sub',
      docsMap: { pages: [] },
    };
    const file = 'docs/x.md';
    const content = '# x\n\n```ts\nimport { atom } from "other/sub"\n```\n';
    const [plural] = buildPageDocuments({ ...shared, files: [{ file, content }] });
    expect(plural).toEqual(buildPageDocument({ ...shared, file, content }));
    expect(plural.claims.filter((c) => c.rule).length).toBe(1);
  });
});

describe('aliased imports are checked by their imported name', () => {
  function valtioSpec(): ApiSpec {
    return {
      meta: { name: 'valtio' },
      exports: [
        { id: 'snapshot', name: 'snapshot', kind: 'function' },
        {
          id: 'useSnapshot',
          name: 'useSnapshot',
          kind: 'function',
          signatures: [
            { parameters: [{ name: 'proxyObject', required: true, schema: { type: 'object' } }] },
          ],
        },
      ],
    };
  }

  function valtioRules(code: string) {
    const spec = valtioSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/guide.md',
      content: `# Guide\n\n\`\`\`ts\n${code}\n\`\`\`\n`,
    }).claims.filter((c) => c.rule);
  }

  test('alias of a real export is not a broken reference', () => {
    expect(
      valtioRules("import { snapshot, useSnapshot as useSnapshotOrig } from 'valtio'"),
    ).toEqual([]);
  });

  test('alias of a missing export is reported under the imported name', () => {
    const hits = valtioRules("import { useSnap as useSnapshotOrig } from 'valtio'");
    expect(hits.map((c) => c.rule?.issue)).toEqual([
      "Import 'useSnap' from 'valtio' does not exist in package exports",
    ]);
    expect(hits[0]?.text).toBe('useSnap');
    expect(hits[0]?.locator.start).toEqual({ line: 4, col: 10 });
  });

  test('call through the alias is checked against the aliased export', () => {
    const hits = valtioRules(
      "import { useSnapshot as useSnapshotOrig } from 'valtio'\nuseSnapshotOrig(state, extra, more)",
    );
    expect(hits.map((c) => c.rule?.type)).toEqual(['prose-arity-mismatch']);
    expect(hits[0]?.specRef?.export).toBe('useSnapshot');
    expect(hits[0]?.rule?.issue).toContain("'useSnapshot'");
  });

  test('alias in an earlier fence still binds a later call', () => {
    const spec = valtioSpec();
    const d = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/guide.md',
      content:
        "# Guide\n\n```ts\nimport { useSnapshot as useSnap } from 'valtio'\n```\n\nLater:\n\n```ts\nconst snap = useSnap()\n```\n",
    });
    expect(d.claims.filter((c) => c.rule).map((c) => c.rule?.type)).toEqual([
      'prose-missing-required',
    ]);
  });

  test('default imports never misfire', () => {
    expect(valtioRules("import { default as x } from 'valtio'")).toEqual([]);
    expect(valtioRules("import x, { snapshot as z } from 'valtio'")).toEqual([]);
    expect(valtioRules("import x from 'valtio'")).toEqual([]);
  });

  test('default import next to a missing named import still reports the named one', () => {
    expect(valtioRules("import x, { nope as z } from 'valtio'").map((c) => c.rule?.issue)).toEqual([
      "Import 'nope' from 'valtio' does not exist in package exports",
    ]);
  });
});

describe('prose-deprecated-reference reads the deprecation note of the enclosing section', () => {
  function watchSpec(): ApiSpec {
    return {
      meta: { name: 'valtio' },
      exports: [
        {
          id: 'watch',
          name: 'watch',
          kind: 'function',
          deprecated: true,
          deprecationReason: 'Use `effect` instead.',
        },
        { id: 'effect', name: 'effect', kind: 'function' },
        { id: 'proxy', name: 'proxy', kind: 'function' },
      ],
    };
  }

  const FILLER = 'One.\n\nTwo.\n\nThree.\n\nFour.\n\nFive.\n\nSix.\n';
  const FENCE_WATCH =
    "```js\nimport { proxy } from 'valtio'\nimport { watch } from 'valtio'\n```\n";

  function deprecated(content: string) {
    const spec = watchSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/api/utils/watch.mdx',
      content,
    }).claims.filter((c) => c.rule?.type === 'prose-deprecated-reference');
  }

  test('note under the H1 covers a fence in a later subsection (valtio watch.mdx)', () => {
    const content = `---\ntitle: 'watch'\n---\n\n# \`watch\`\n\n> **⚠️ Deprecated**\n>\n> Please migrate.\n\n## Subscription via a getter\n\n${FILLER}\n${FENCE_WATCH}`;
    expect(deprecated(content)).toEqual([]);
  });

  test('"no longer maintained", "legacy", and the replacement name each count', () => {
    for (const note of [
      'This util is NO LONGER MAINTAINED.',
      'A Legacy helper.',
      'Prefer `effect` for new code.',
    ]) {
      const content = `# Utils\n\n## watch\n\n${note}\n\n${FILLER}\n${FENCE_WATCH}`;
      expect(deprecated(content)).toEqual([]);
    }
  });

  test('frontmatter counts for the whole page', () => {
    const content = `---\ntitle: watch\ndeprecated: true\n---\n\n# watch\n\n## Usage\n\n${FILLER}\n${FENCE_WATCH}`;
    expect(deprecated(content)).toEqual([]);
  });

  test('a note in a sibling section does not cover the mention', () => {
    const content = `# Utils\n\n## old\n\nThis one is deprecated.\n\n${FILLER}\n## watch\n\n${FILLER}\n${FENCE_WATCH}`;
    const hits = deprecated(content);
    expect(hits.map((c) => c.rule?.issue)).toEqual([
      "Docs reference deprecated API 'watch' without noting the deprecation",
    ]);
    expect(hits[0]?.locator.headingText).toBe('watch');
    expect(hits[0]?.text).toBe('watch');
  });

  test('no note anywhere still fires, located on the import, not the frontmatter title', () => {
    const content = `---\ntitle: 'watch'\n---\n\n# \`watch\`\n\n## Usage\n\n${FILLER}\n${FENCE_WATCH}`;
    const hits = deprecated(content);
    expect(hits.length).toBe(1);
    expect(hits[0]?.locator.start).toEqual({ line: 23, col: 10 });
  });
});

describe('closed object shape terminates', () => {
  test('an external type entry that names itself is open, not a stack overflow', () => {
    const spec: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'Slot',
          name: 'Slot',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'fallback', required: true, schema: { $ref: '#/types/ReactNode' } },
              ],
            },
          ],
        },
      ],
      types: [
        {
          id: 'ReactNode',
          name: 'ReactNode',
          kind: 'external',
          schema: { 'x-ts-type': 'ReactNode', 'x-ts-package': '@types/react' },
        },
      ],
    };
    const d = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/slot.md',
      content:
        '# Slot\n\n| Prop | Type |\n|---|---|\n| `fallback` | `ReactNode` |\n\n```tsx\nSlot({ a: 1 })\n```\n',
    });
    expect(d.claims.filter((c) => c.rule)).toEqual([]);
  });
});

describe('prose-param-mismatch: parameter tables and lists', () => {
  function paramSpec(): ApiSpec {
    return {
      meta: { name: PKG },
      exports: [
        {
          id: 'useLiveStateData',
          name: 'useLiveStateData',
          kind: 'function',
          signatures: [
            {
              typeParameters: [{ name: 'T' }],
              parameters: [{ name: 'key', required: true, schema: { type: 'string' } }],
            },
          ],
        },
        {
          id: 'useLiveState',
          name: 'useLiveState',
          kind: 'function',
          signatures: [
            {
              typeParameters: [{ name: 'T' }],
              parameters: [
                { name: 'key', required: true, schema: { type: 'string' } },
                { name: 'initialValue', required: true, schema: { 'x-ts-type': 'T' } },
                {
                  name: 'opts',
                  required: false,
                  schema: { type: 'object', properties: { syncDuration: { type: 'number' } } },
                },
              ],
            },
          ],
        },
        {
          id: 'useFollowUser',
          name: 'useFollowUser',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'opts', required: false, schema: { $ref: '#/types/FollowOptions' } },
              ],
            },
          ],
        },
        {
          id: 'configure',
          name: 'configure',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'name', required: true, schema: { type: 'string' } },
                {
                  name: 'settings',
                  required: false,
                  schema: { type: 'object', properties: { syncDuration: { type: 'number' } } },
                },
              ],
            },
          ],
        },
        {
          id: 'connect',
          name: 'connect',
          kind: 'function',
          signatures: [
            { parameters: [{ name: 'url', required: true, schema: { type: 'string' } }] },
            {
              parameters: [
                { name: 'url', required: true, schema: { type: 'string' } },
                { name: 'retries', required: false, schema: { type: 'number' } },
              ],
            },
          ],
        },
        {
          id: 'merge',
          name: 'merge',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'target', required: true, schema: { type: 'string' } },
                { name: 'options', required: false, schema: { $ref: '#/types/ExternalOptions' } },
              ],
            },
          ],
        },
        {
          id: 'LivelyClient',
          name: 'LivelyClient',
          kind: 'class',
          signatures: [
            {
              parameters: [
                { name: 'serverUrl', required: true, schema: { type: 'string' } },
                { name: 'reconnect', required: false, schema: { type: 'boolean' } },
              ],
            },
          ],
          members: [{ name: 'joinRoom', kind: 'method' }],
        },
        {
          id: 'RoomProvider',
          name: 'RoomProvider',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'roomId', required: true, schema: { type: 'string' } },
                { name: 'userId', required: true, schema: { type: 'string' } },
                { name: 'children', required: true, schema: { $ref: '#/types/ReactNode' } },
              ],
            },
          ],
        },
        {
          id: 'Avatar',
          name: 'Avatar',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'props', required: true, schema: { $ref: '#/types/AvatarProps' } },
              ],
            },
          ],
        },
      ],
      types: [
        {
          id: 'FollowOptions',
          name: 'FollowOptions',
          kind: 'interface',
          members: [
            { name: 'lerpFactor', kind: 'property' },
            { name: 'exitOnInteraction', kind: 'property' },
          ],
        },
        {
          id: 'AvatarProps',
          name: 'AvatarProps',
          kind: 'interface',
          members: [
            { name: 'src', kind: 'property' },
            { name: 'size', kind: 'property' },
          ],
        },
      ],
    };
  }

  function paramHits(content: string) {
    const spec = paramSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/hooks/use-live-state.md',
      content,
    }).claims.filter((c) => c.rule?.type === 'prose-param-mismatch');
  }

  const HEAD3 = '| Param | Type | Description |\n|-------|------|-------------|\n';

  test('row key that is not a parameter of the heading export', () => {
    const hits = paramHits(
      `# Hooks\n\n### \`useLiveStateData<T>(key)\`\n\n${HEAD3}| \`keyKey\` | \`string\` | The state key |\n`,
    );
    expect(hits.length).toBe(1);
    expect(hits[0]?.kind).toBe('table-key');
    expect(hits[0]?.text).toBe('keyKey');
    expect(hits[0]?.locator.start).toEqual({ line: 7, col: 3 });
    expect(hits[0]?.locator.end).toEqual({ line: 7, col: 10 });
    expect(hits[0]?.specRef?.export).toBe('useLiveStateData');
    expect(hits[0]?.rule?.issue).toBe(
      "Parameter 'keyKey' is not a parameter of 'useLiveStateData'",
    );
    expect(hits[0]?.rule?.suggestion).toBe('Parameters: key');
    expect(hits[0]?.candidate).toBe(false);
  });

  test('correct table is silent; trailing ? and a generic param type do not matter', () => {
    expect(
      paramHits(
        `# useLiveState\n\n${HEAD3}| \`key\` | \`string\` | k |\n| \`initialValue\` | \`T\` | v |\n| \`opts?\` | \`object\` | o |\n`,
      ),
    ).toEqual([]);
  });

  test('walks up past a Parameters heading; a renamed row next to real ones fires', () => {
    const hits = paramHits(
      `# Hooks\n\n## useLiveState\n\n#### Parameters\n\n${HEAD3}| \`key\` | \`string\` | k |\n| \`initial\` | \`T\` | v |\n`,
    );
    expect(hits.map((c) => c.rule?.issue)).toEqual([
      "Parameter 'initial' is not a parameter of 'useLiveState'",
    ]);
    expect(hits[0]?.rule?.suggestion).toBe('Parameters: key, initialValue, opts');
  });

  test('a name from any overload is a parameter', () => {
    expect(
      paramHits(
        `# connect\n\n${HEAD3}| \`url\` | \`string\` | u |\n| \`retries\` | \`number\` | r |\n`,
      ),
    ).toEqual([]);
  });

  test('class constructor parameters', () => {
    const hits = paramHits(
      `# \`new LivelyClient(serverUrl, reconnect)\`\n\n| Argument | Description |\n|---|---|\n| \`serverUrl\` | u |\n| \`autoReconnect\` | r |\n`,
    );
    expect(hits.map((c) => c.rule?.issue)).toEqual([
      "Parameter 'autoReconnect' is not a parameter of 'LivelyClient'",
    ]);
  });

  test('options.key is checked against the closed options type', () => {
    const hits = paramHits(
      `# configure\n\n${HEAD3}| \`name\` | \`string\` | n |\n| \`settings.syncDuration\` | \`number\` | ok |\n| \`settings.syncMode\` | \`string\` | bad |\n| \`options.mode\` | \`string\` | bad |\n`,
    );
    expect(hits.map((c) => c.rule?.issue)).toEqual([
      "Parameter 'settings.syncMode' is not a parameter of 'configure'",
      "Parameter 'options.mode' is not a parameter of 'configure'",
    ]);
    expect(hits[0]?.text).toBe('settings.syncMode');
    expect(hits[0]?.rule?.suggestion).toBe('Properties: syncDuration');
  });

  test('Option table on a function whose single parameter is a closed object type', () => {
    const hits = paramHits(
      `# useFollowUser\n\n### Options\n\n| Option | Type | Default | Description |\n|---|---|---|---|\n| \`lerpFactor\` | \`number\` | \`0.25\` | l |\n| \`exitOnClick\` | \`boolean\` | \`true\` | e |\n`,
    );
    expect(hits.map((c) => c.rule?.issue)).toEqual([
      "Option 'exitOnClick' is not an option of 'useFollowUser'",
    ]);
    expect(hits[0]?.rule?.suggestion).toBe('Options: exitOnInteraction, lerpFactor');
  });

  test('Prop table on a component: destructured props and a single closed props type', () => {
    const flat = paramHits(
      `# \`<RoomProvider>\`\n\n| Prop | Type | Description |\n|---|---|---|\n| \`roomId\` | \`string\` | r |\n| \`user\` | \`string\` | u |\n| \`children\` | \`ReactNode\` | c |\n`,
    );
    expect(flat.map((c) => c.rule?.issue)).toEqual(["Prop 'user' is not a prop of 'RoomProvider'"]);
    const typed = paramHits(
      `# Avatar\n\n## Props\n\n| Prop | Type |\n|---|---|\n| \`src\` | \`string\` |\n| \`radius\` | \`number\` |\n`,
    );
    expect(typed.map((c) => c.rule?.issue)).toEqual(["Prop 'radius' is not a prop of 'Avatar'"]);
  });

  test('primitive Type cell that contradicts a primitive spec type', () => {
    const hits = paramHits(
      `# connect\n\n${HEAD3}| \`url\` | \`number\` | u |\n| \`retries\` | \`number\` | r |\n`,
    );
    expect(hits.map((c) => c.rule?.issue)).toEqual([
      "Parameter 'url' is documented as 'number', spec says 'string'",
    ]);
    expect(hits[0]?.text).toBe('url');
  });

  test('non-primitive Type cells and non-primitive spec types are never compared', () => {
    expect(
      paramHits(
        `# useLiveState\n\n${HEAD3}| \`key\` | \`string \\| number\` | k |\n| \`initialValue\` | \`number\` | generic |\n| \`opts\` | [\`Options\`](#options) | o |\n`,
      ),
    ).toEqual([]);
  });

  test('bullet list under a Parameters heading; nested option bullets are not rows', () => {
    const hits = paramHits(
      `# useLiveState\n\n## Parameters\n\n- \`key\` <Property {...properties.key} />\n- **optional** \`initial\`: the value\n  - \`nested\`: not a row\n- \`opts\`: options\n\n## Returns\n\n- \`Value\` the value\n`,
    );
    expect(hits.map((c) => c.rule?.issue)).toEqual([
      "Parameter 'initial' is not a parameter of 'useLiveState'",
    ]);
    expect(hits[0]?.locator.start).toEqual({ line: 6, col: 16 });
  });

  describe('silent', () => {
    const BAD_ROW = '| `keyKey` | `string` | The state key |\n';

    test('heading names more than one export, or none', () => {
      expect(paramHits(`# useLiveStateData / useLiveState\n\n${HEAD3}${BAD_ROW}`)).toEqual([]);
      expect(paramHits(`# useLiveStateData and friends\n\n${HEAD3}${BAD_ROW}`)).toEqual([]);
      expect(paramHits(`# Getting started\n\n${HEAD3}${BAD_ROW}`)).toEqual([]);
      expect(paramHits(`${HEAD3}${BAD_ROW}`)).toEqual([]);
    });

    test('a section that is not about parameters between the table and the export', () => {
      expect(
        paramHits(
          `# useFollowUser\n\n### Returns\n\n| Property | Type | Description |\n|---|---|---|\n| \`followers\` | \`string[]\` | f |\n`,
        ),
      ).toEqual([]);
      expect(
        paramHits(`# useLiveStateData\n\n## Exponential backoff\n\n${HEAD3}${BAD_ROW}`),
      ).toEqual([]);
    });

    test('Property table of return values directly under the export heading', () => {
      expect(
        paramHits(
          `# useFollowUser\n\n| Property | Type | Description |\n|---|---|---|\n| \`followers\` | \`string[]\` | f |\n| \`stopFollowing\` | \`() => void\` | s |\n`,
        ),
      ).toEqual([]);
    });

    test('open, generic, or unresolved parameter type for an Option table', () => {
      expect(
        paramHits(
          `# merge\n\n## Options\n\n| Option | Type |\n|---|---|\n| \`target\` | \`string\` |\n| \`deep\` | \`boolean\` |\n`,
        ),
      ).toEqual([]);
      expect(
        paramHits(
          `# useLiveState\n\n## Options\n\n| Option | Type |\n|---|---|\n| \`syncDuration\` | \`number\` |\n| \`deep\` | \`boolean\` |\n`,
        ),
      ).toEqual([]);
      expect(
        paramHits(
          `# merge\n\n${HEAD3}| \`target\` | \`string\` | t |\n| \`options.deep\` | \`boolean\` | d |\n`,
        ),
      ).toEqual([]);
    });

    test('a ...rest row silences the table', () => {
      expect(
        paramHits(
          `# connect\n\n${HEAD3}| \`uri\` | \`string\` | u |\n| \`...args\` | \`any[]\` | a |\n`,
        ),
      ).toEqual([]);
    });

    test('empty or prose row keys', () => {
      expect(
        paramHits(
          `# connect\n\n| Parameter | Value | Side |\n|---|---|---|\n| Client ping interval | 30s | client |\n| Server timeout | 45s | server |\n`,
        ),
      ).toEqual([]);
      expect(
        paramHits(`# connect\n\n${HEAD3}| \`url\` | \`string\` | u |\n| | | continued |\n`),
      ).toEqual([]);
    });

    test('a table of hooks/exports is a different table', () => {
      expect(
        paramHits(
          `# useLiveState\n\n| Hook | Signature |\n|---|---|\n| \`useLiveStateData\` | \`(key)\` |\n`,
        ),
      ).toEqual([]);
      expect(
        paramHits(
          `# useLiveState\n\n| Name | Description |\n|---|---|\n| \`key\` | k |\n| \`useLiveStateData\` | read only |\n| \`connect\` | c |\n`,
        ),
      ).toEqual([]);
    });

    test('two or more rows and none is a parameter: the table is about something else', () => {
      expect(
        paramHits(
          `# useLiveState\n\n${HEAD3}| \`alpha\` | \`string\` | a |\n| \`beta\` | \`string\` | b |\n`,
        ),
      ).toEqual([]);
    });

    test("names the page itself uses in the export's signature are display names", () => {
      expect(
        paramHits(
          `# useStore\n\n### \`connect(serverUrl, retryCount)\`\n\n#### Parameters\n\n- \`serverUrl\`: the url\n- \`retries\`: count\n`,
        ),
      ).toEqual([]);
      expect(
        paramHits(
          `# useLiveStateData\n\n\`\`\`ts\nconst v = useLiveStateData<T>(stateKey)\n\`\`\`\n\n## Parameters\n\n- \`stateKey\`: the key\n`,
        ),
      ).toEqual([]);
    });

    test('a table inside a fence, and a list under a heading that is not Parameters', () => {
      expect(paramHits(`# useLiveStateData\n\n\`\`\`md\n${HEAD3}${BAD_ROW}\`\`\`\n`)).toEqual([]);
      expect(paramHits('# useLiveStateData\n\n## Notes\n\n- `keyKey`: something\n')).toEqual([]);
    });
  });

  test('a rule hit replaces the rule-less table-key inventory claim on the same cell', () => {
    const spec = paramSpec();
    const d = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/hooks/use-follow-user.md',
      content:
        '# useFollowUser\n\n### Options\n\n| Option | Type |\n|---|---|\n| `lerpFactor` | `number` |\n| `exitOnClick` | `boolean` |\n',
    });
    const onRow = d.claims.filter((c) => c.kind === 'table-key' && c.locator.start.line === 8);
    expect(onRow.map((c) => c.rule?.type)).toEqual(['prose-param-mismatch']);
  });
});

describe('a # line inside a fenced code block is not a heading', () => {
  const F3 = '```';
  const F4 = '````';

  test('bash comment: claims after the fence keep the real heading', () => {
    const doc = page(
      'docs/api/room.md',
      `# Room\n\n${F3}bash\n# install\nnpm i lively\n${F3}\n\nSee \`Room\`.\n`,
    );
    const mention = doc.claims.find((c) => c.kind === 'inline' && c.text === 'Room');
    expect(mention?.locator.start.line).toBe(8);
    expect(mention?.locator.headingText).toBe('Room');
    expect(mention?.locator.headingId).toBe('room');
    expect(doc.claims.filter((c) => c.kind === 'heading').map((c) => c.text)).toEqual(['Room']);
  });

  test('tilde, info string, indented and unclosed fences', () => {
    const texts = (md: string) => collectHeadings(md).map((h) => h.text);
    expect(texts('# a\n\n~~~sh title="x"\n# no\n~~~\n\n## b\n')).toEqual(['a', 'b']);
    expect(texts('# a\n\n- step\n\n  ```sh\n  # no\n  ```\n\n## b\n')).toEqual(['a', 'b']);
    expect(texts('# a\n\n```sh\n# no\n## still no\n')).toEqual(['a']);
  });

  test('a fence closes only on its own marker, at least as long', () => {
    const texts = (md: string) => collectHeadings(md).map((h) => h.text);
    expect(texts(`# a\n\n${F4}md\n${F3}sh\n# no\n${F3}\n# nor this\n${F4}\n\n## b\n`)).toEqual([
      'a',
      'b',
    ]);
    expect(texts(`# a\n\n${F3}md\n~~~\n# no\n~~~\n# nor this\n${F3}\n\n## b\n`)).toEqual([
      'a',
      'b',
    ]);
    // A closing fence carries no info string.
    expect(texts(`# a\n\n${F3}md\n${F3}ts\n# no\n${F3}\n\n## b\n`)).toEqual(['a', 'b']);
  });

  test('slugs count real headings only', () => {
    const headings = collectHeadings(`# Setup\n\n${F3}sh\n# Setup\n${F3}\n\n## Setup\n`);
    expect(headings.map((h) => h.id)).toEqual(['setup', 'setup-1']);
  });

  test('prose and inline scanners: text inside a longer outer fence stays code', () => {
    const doc = page(
      'docs/guide.md',
      `# Guide\n\n${F4}md\n${F3}ts\nUse \`Room\` and call useStorage here.\n${F3}\n${F4}\n`,
    );
    expect(doc.claims.filter((c) => c.kind === 'inline' || c.kind === 'prose')).toEqual([]);
  });

  test('migration heading lookup ignores a # line in an earlier fence', () => {
    const doc = page(
      'docs/guide.md',
      `# Guide\n\n${F3}sh\n# Before\n${F3}\n\n${F3}ts\nconst room = useStorage();\nroom.nope();\n${F3}\n`,
    );
    expect(rules(doc).map((c) => c.rule?.type)).toEqual(['prose-unresolved-member']);
  });
});

describe('fence claims are located inside their own fence', () => {
  const F3 = '```';

  function locSpec(): ApiSpec {
    return {
      meta: { name: 'netlib' },
      exports: [
        {
          id: 'connect',
          name: 'connect',
          kind: 'function',
          signatures: [
            {
              parameters: [{ name: 'url', required: true, schema: { type: 'string' } }],
              returns: { schema: { $ref: '#/types/Socket' } },
            },
          ],
        },
        {
          id: 'Panel',
          name: 'Panel',
          kind: 'function',
          signatures: [
            {
              parameters: [
                {
                  name: 'props',
                  required: true,
                  schema: {
                    type: 'object',
                    properties: { title: { type: 'string' } },
                    required: ['title'],
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'Socket',
          name: 'Socket',
          kind: 'class',
          members: [{ name: 'send', kind: 'method' }],
        },
      ],
    };
  }

  function locRules(content: string) {
    const spec = locSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/connect.md',
      content,
    }).claims.filter((c) => c.rule);
  }

  function textAt(content: string, c: { locator: { start: { line: number; col: number } } }) {
    return (content.split('\n')[c.locator.start.line - 1] ?? '').slice(c.locator.start.col - 1);
  }

  test('call on the first code line; the same text earlier in prose', () => {
    const content = `# connect\n\nInline \`connect(a, b)\` is wrong.\n\nSee:\n${F3}ts\nconnect(a, b)\n${F3}\n`;
    const hits = locRules(content);
    expect(hits.map((c) => c.rule?.type)).toEqual(['prose-arity-mismatch']);
    expect(hits[0]?.locator.start).toEqual({ line: 7, col: 1 });
    expect(hits[0]?.locator.end).toEqual({ line: 7, col: 13 });
  });

  test('call on a later, indented code line', () => {
    const content = `# connect\n\nInline \`connect(a, b)\`.\n\n${F3}ts\nfunction go() {\n  const x = 1\n  return connect(a, b)\n}\n${F3}\n`;
    const hits = locRules(content);
    expect(hits.map((c) => c.locator.start)).toEqual([{ line: 8, col: 10 }]);
    expect(textAt(content, hits[0])).toStartWith('connect(a, b)');
  });

  test('the same call twice in one fence: two claims, two locators', () => {
    const content = `# connect\n\n${F3}ts\nconnect(a, b)\nlog()\nconnect(a, b)\n${F3}\n`;
    const hits = locRules(content);
    expect(hits.map((c) => c.locator.start)).toEqual([
      { line: 4, col: 1 },
      { line: 6, col: 1 },
    ]);
    expect(new Set(hits.map((c) => c.id)).size).toBe(2);
  });

  test('the same call in two fences: each claim in its own fence', () => {
    const content = `# connect\n\n${F3}ts\nconnect(a, b)\n${F3}\n\nAgain:\n\n${F3}ts\nsetup()\nconnect(a, b)\n${F3}\n`;
    expect(locRules(content).map((c) => c.locator.start)).toEqual([
      { line: 4, col: 1 },
      { line: 11, col: 1 },
    ]);
  });

  test('fence inside a list item (indented fence)', () => {
    const content = `# connect\n\n1. Call \`connect(a, b)\`:\n\n   ${F3}ts\n   setup()\n   connect(a, b)\n   ${F3}\n`;
    const hits = locRules(content);
    expect(hits.map((c) => c.locator.start)).toEqual([{ line: 7, col: 4 }]);
    expect(hits[0]?.locator.end).toEqual({ line: 7, col: 16 });
    expect(textAt(content, hits[0])).toStartWith('connect(a, b)');
  });

  test('multi-line call: start at the callee, end on the closing paren', () => {
    const content = `# connect\n\n- step\n\n  ${F3}ts\n  connect(\n    a,\n    b,\n  )\n  ${F3}\n`;
    const hits = locRules(content);
    expect(hits[0]?.locator.start).toEqual({ line: 6, col: 3 });
    expect(hits[0]?.locator.end).toEqual({ line: 9, col: 3 });
  });

  test('JSX: missing-required and unknown-key sit on the element, not on earlier prose', () => {
    const content = `# Panel\n\nRender \`<Panel heading="x" />\` anywhere.\n\n${F3}tsx\nconst a = 1\nconst el = <Panel heading="x" />\n${F3}\n`;
    const hits = locRules(content);
    expect(hits.map((c) => c.rule?.type).sort()).toEqual([
      'prose-missing-required',
      'prose-unknown-key',
    ]);
    for (const c of hits) expect(c.locator.start).toEqual({ line: 7, col: 12 });
  });

  test('unresolved member: the call on its own line, not the first occurrence', () => {
    const content = `# connect\n\nNever call \`socket.emit("x")\`.\n\n${F3}ts\nconst socket = connect(url)\n\nsocket.emit("x")\n${F3}\n`;
    const hits = locRules(content);
    expect(hits.map((c) => c.rule?.type)).toEqual(['prose-unresolved-member']);
    expect(hits[0]?.locator.start).toEqual({ line: 8, col: 1 });
  });

  test('broken import: the specifier inside an indented fence', () => {
    const content = `# connect\n\nThere is no \`nope\` export.\n\n- step\n\n  ${F3}ts\n  import { connect, nope } from 'netlib'\n  ${F3}\n`;
    const hits = locRules(content);
    expect(hits.map((c) => c.rule?.type)).toEqual(['prose-broken-reference']);
    expect(hits[0]?.locator.start).toEqual({ line: 8, col: 21 });
    expect(hits[0]?.locator.end).toEqual({ line: 8, col: 24 });
  });

  test('broken import: the specifier, not the same word earlier on the line', () => {
    const content = `# connect\n\n${F3}ts\nimport { port as p, connect } from 'netlib' /* port */\n${F3}\n`;
    const hits = locRules(content);
    expect(hits[0]?.locator.start).toEqual({ line: 4, col: 10 });
    const twice = `# connect\n\n${F3}ts\nimport { im } from 'netlib'\n${F3}\n`;
    expect(locRules(twice)[0]?.locator.start).toEqual({ line: 4, col: 10 });
  });
});

describe('a rest parameter is never required', () => {
  type Param = NonNullable<
    NonNullable<NonNullable<ApiSpec['exports']>[number]['signatures']>[number]['parameters']
  >[number];

  function restRules(parameters: Param[], code: string) {
    const spec: ApiSpec = {
      meta: { name: 'zod' },
      exports: [
        { id: 'stringbool', name: 'stringbool', kind: 'function', signatures: [{ parameters }] },
      ],
      types: [
        {
          id: 'Options',
          name: 'Options',
          kind: 'interface',
          schema: { type: 'object', properties: { truthy: { type: 'array' } } },
        },
      ],
    };
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/api.md',
      content: `# API\n\n\`\`\`ts\n${code}\n\`\`\`\n`,
    })
      .claims.filter((c) => c.rule)
      .map((c) => c.rule?.issue);
  }

  const CALLS = 'const a = stringbool()\nconst b = stringbool(1, 2, 3, 4)';

  test('rest: true, even when the spec also says required', () => {
    expect(
      restRules([{ name: 'args', required: true, rest: true, schema: { type: 'array' } }], CALLS),
    ).toEqual([]);
  });

  test("a parameter emitted as '...args'", () => {
    expect(
      restRules([{ name: '...args', required: true, schema: { type: 'array' } }], CALLS),
    ).toEqual([]);
  });

  test("an untyped trailing 'args' is what (...args) => extracts to", () => {
    expect(
      restRules([{ name: 'args', required: true, schema: { 'x-ts-type': 'unknown' } }], CALLS),
    ).toEqual([]);
  });

  test('parameters before the rest parameter are still required', () => {
    expect(
      restRules(
        [
          { name: 'first', required: true, schema: { 'x-ts-type': 'unknown' } },
          { name: 'more', required: true, rest: true, schema: { type: 'array' } },
        ],
        CALLS,
      ),
    ).toEqual(["Call 'stringbool' is missing required argument 'first'"]);
  });

  test("a trailing 'args' typed as a named object is an ordinary parameter", () => {
    expect(
      restRules([{ name: 'args', required: true, schema: { $ref: '#/types/Options' } }], CALLS),
    ).toEqual([
      "Call 'stringbool' is missing required argument 'args'",
      "Call 'stringbool' has 4 arguments; spec allows at most 1",
    ]);
    expect(
      restRules(
        [
          { name: 'args', required: true, schema: { 'x-ts-type': 'unknown' } },
          { name: 'last', required: true, schema: { type: 'string' } },
        ],
        'const a = stringbool()',
      ),
    ).toEqual(["Call 'stringbool' is missing required argument 'args', 'last'"]);
  });
});

describe('a zero-argument call as a bare statement is a mention, not a call', () => {
  function zSpec(): ApiSpec {
    const schema = { 'x-ts-type': 'unknown' };
    return {
      meta: { name: 'zod' },
      exports: [
        {
          id: 'map',
          name: 'map',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'keyType', required: true, schema },
                { name: 'valueType', required: true, schema },
              ],
            },
          ],
        },
        {
          id: 'Box',
          name: 'Box',
          kind: 'function',
          signatures: [{ parameters: [{ name: 'size', required: true, schema }] }],
        },
      ],
    };
  }

  function missing(code: string, lang = 'ts') {
    const spec = zSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/json-schema.md',
      content: `# JSON Schema\n\n\`\`\`${lang}\nimport * as z from 'zod'\n${code}\n\`\`\`\n`,
    })
      .claims.filter((c) => c.rule?.type === 'prose-missing-required')
      .map((c) => c.text);
  }

  test('the unrepresentable-types list names APIs', () => {
    expect(missing('z.bigint(); // ❌\nz.map(); // ❌\nz.set(); // ❌')).toEqual([]);
    expect(missing('z.map()')).toEqual([]);
    expect(missing("import { map } from 'zod'\nmap();")).toEqual([]);
  });

  test('a chained bare statement is still a bare statement', () => {
    expect(missing('z.map().optional();')).toEqual([]);
    expect(missing('z.map()!.optional().nullable();')).toEqual([]);
    expect(missing('(z.map());')).toEqual([]);
  });

  test('a used result still fires', () => {
    expect(missing('const m = z.map()')).toEqual(['z.map()']);
    expect(missing('const m = z.map().optional()')).toEqual(['z.map()']);
    expect(missing('foo(z.map())')).toEqual(['z.map()']);
    expect(missing('function f() {\n  return z.map()\n}')).toEqual(['z.map()']);
    expect(missing('const f = () => z.map()')).toEqual(['z.map()']);
    expect(missing('await z.map();')).toEqual(['z.map()']);
    expect(missing('const el = <div>{z.map()}</div>', 'tsx')).toEqual(['z.map()']);
    expect(missing('const s = { m: z.map() }')).toEqual(['z.map()']);
  });

  test('a bare statement with arguments still fires', () => {
    expect(missing('z.map(z.string());')).toEqual(['z.map(z.string())']);
  });

  test('JSX and new are not bare calls', () => {
    expect(missing('<z.Box />;', 'tsx')).toEqual(['<z.Box />']);
  });
});

describe('invalid import syntax is not blamed on an export', () => {
  function zustandSpec(): ApiSpec {
    return {
      meta: { name: 'zustand' },
      exports: [
        {
          id: 'create',
          name: 'create',
          kind: 'function',
          signatures: [
            { parameters: [{ name: 'initializer', required: true, schema: { type: 'object' } }] },
          ],
        },
        { id: 'createStore', name: 'createStore', kind: 'function' },
      ],
    };
  }

  function importRules(code: string) {
    const spec = zustandSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/guides/how-to-reset-state.md',
      content: `# Reset\n\n\`\`\`ts\n${code}\n\`\`\`\n`,
    }).claims.filter((c) => c.rule);
  }

  test('`name: alias` in import braces: the claim says what is true, on that specifier', () => {
    const hits = importRules(
      "import type { StateCreator } from 'other'\nimport { create: actualCreate } from 'zustand'",
    );
    expect(hits.map((c) => [c.rule?.type, c.rule?.issue, c.rule?.suggestion])).toEqual([
      [
        'prose-broken-reference',
        '`create: actualCreate` is not valid import syntax; did you mean `create as actualCreate`?',
        'create as actualCreate',
      ],
    ]);
    expect(hits[0]?.text).toBe('create: actualCreate');
    expect(hits[0]?.specRef?.export).toBe('create');
    expect(hits[0]?.candidate).toBe(false);
    expect(hits[0]?.locator.start).toEqual({ line: 5, col: 10 });
    expect(hits[0]?.locator.end).toEqual({ line: 5, col: 29 });
  });

  test('among valid specifiers, and with loose spacing', () => {
    const hits = importRules("import { createStore, create  :actualCreate } from 'zustand'");
    expect(hits.map((c) => c.rule?.issue)).toEqual([
      '`create: actualCreate` is not valid import syntax; did you mean `create as actualCreate`?',
    ]);
    expect(hits[0]?.text).toBe('create  :actualCreate');
    expect(hits[0]?.locator.start).toEqual({ line: 4, col: 23 });
  });

  test('the intended alias still binds: calls through it are checked against the export', () => {
    const hits = importRules(
      "import { create: actualCreate } from 'zustand'\nconst store = actualCreate(a, b)",
    );
    expect(hits.map((c) => c.rule?.type)).toEqual([
      'prose-broken-reference',
      'prose-arity-mismatch',
    ]);
    expect(hits[1]?.specRef?.export).toBe('create');
  });

  test('a missing export in an invalid pair is reported under the name it imports', () => {
    expect(importRules("import { nope: x } from 'zustand'").map((c) => c.rule?.issue)).toEqual([
      '`nope: x` is not valid import syntax; did you mean `nope as x`?',
      "Import 'nope' from 'zustand' does not exist in package exports",
    ]);
  });

  test('another package, a valid alias, and import attributes are silent', () => {
    expect(importRules("import { create: actualCreate } from 'redux'")).toEqual([]);
    expect(importRules("import { create as actualCreate } from 'zustand'")).toEqual([]);
    expect(
      importRules(
        "import { create } from 'zustand'\nimport data from './d.json' with { type: 'json' }",
      ),
    ).toEqual([]);
  });
});

describe("a default import binds to the package's default export", () => {
  const F3 = '```';
  const any = { 'x-ts-type': 'unknown' };

  function swrSpec(withDefault = true): ApiSpec {
    const overloads = [
      { parameters: [{ name: 'key', required: true, schema: any }] },
      {
        parameters: [
          { name: 'key', required: true, schema: any },
          { name: 'fetcher', required: true, schema: any },
        ],
      },
      {
        parameters: [
          { name: 'key', required: true, schema: any },
          { name: 'fetcher', required: true, schema: any },
          {
            name: 'config',
            required: true,
            schema: { type: 'object', properties: { suspense: { type: 'boolean' } } },
          },
        ],
      },
    ];
    return {
      meta: { name: 'swr' },
      exports: [
        ...(withDefault
          ? [{ id: 'default', name: 'default', kind: 'function', signatures: overloads }]
          : []),
        { id: 'useSWR', name: 'useSWR', kind: 'function', signatures: [overloads[0]] },
        { id: 'mutate', name: 'mutate', kind: 'function' },
      ],
    };
  }

  function swrDoc(content: string, withDefault = true) {
    const spec = swrSpec(withDefault);
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/getting-started.md',
      content,
    });
  }

  function fence(code: string): string {
    return `${F3}tsx\n${code}\n${F3}\n`;
  }

  test('call sites are checked against the default export, every overload', () => {
    const doc = swrDoc(
      `# SWR\n\n${fence(
        "import useSWR from 'swr'\nconst a = useSWR('/api', fetcher, { suspense: true })\nconst b = useSWR('/api', fetcher)\nconst c = useSWR('/api')",
      )}`,
    );
    expect(doc.claims.filter((c) => c.rule)).toEqual([]);
  });

  test('arity, missing-required and unknown-key fire through the local name', () => {
    const doc = swrDoc(
      `# SWR\n\n${fence(
        "import useSWR from 'swr'\nconst a = useSWR('/api', fetcher, {}, extra)\nconst b = useSWR()\nconst c = useSWR('/api', fetcher, { suspence: true })",
      )}`,
    );
    const hits = doc.claims.filter((c) => c.rule);
    expect(hits.map((c) => [c.rule?.type, c.specRef?.export, c.locator.start.line])).toEqual([
      ['prose-arity-mismatch', 'default', 5],
      ['prose-missing-required', 'default', 6],
      ['prose-unknown-key', 'default', 7],
    ]);
    expect(hits[0]?.rule?.issue).toBe("Call 'useSWR' has 4 arguments; spec allows at most 3");
    expect(hits[1]?.rule?.issue).toBe("Call 'useSWR' is missing required argument 'key'");
  });

  test('`{ default as x }` and `x, { y }` bind the same way, across fences', () => {
    for (const imp of [
      "import { default as useData } from 'swr'",
      "import useData, { mutate } from 'swr'",
    ]) {
      const doc = swrDoc(
        `# SWR\n\n${fence(imp)}\nLater:\n\n${fence('const a = useData(k, f, {}, extra)')}`,
      );
      const hits = doc.claims.filter((c) => c.rule);
      expect(hits.map((c) => [c.rule?.type, c.specRef?.export])).toEqual([
        ['prose-arity-mismatch', 'default'],
      ]);
      expect(hits[0]?.locator.start).toEqual({ line: 10, col: 11 });
    }
  });

  test('a correct call is an inventory claim a judge can read: specRef default, in its fence', () => {
    const content = `# SWR\n\nCall \`useSWR('/api/user', fetcher)\`.\n\n${fence(
      "import useSWR from 'swr'\n\nfunction Profile() {\n  const { data } = useSWR('/api/user', fetcher)\n}",
    )}\n${fence("const { data } = useSWR('/api/team', fetcher)")}`;
    const bound = swrDoc(content).claims.filter((c) => c.specRef?.export === 'default');
    expect(
      bound.map((c) => [
        c.kind,
        c.text,
        c.candidate,
        c.rule,
        c.locator.start.line,
        c.locator.start.col,
      ]),
    ).toEqual([
      ['inline', 'useSWR', true, undefined, 9, 20],
      ['inline', 'useSWR', true, undefined, 14, 18],
    ]);
    expect(swrDoc(content).slices.map((s) => s.export)).toContain('default');
  });

  test('no default export in the spec: silent, never matched to an export by name', () => {
    const doc = swrDoc(
      `# SWR\n\n${fence("import useSWR from 'swr'\nconst a = useSWR('/api', fetcher, {}, extra)\nconst b = useSWR()")}`,
      false,
    );
    expect(doc.claims.filter((c) => c.rule)).toEqual([]);
    expect(doc.claims.filter((c) => c.specRef?.export === 'default')).toEqual([]);
    expect(doc.claims.filter((c) => c.kind === 'fence')).toEqual([]);
  });

  test("another package's default import binds nothing", () => {
    const doc = swrDoc(
      `# SWR\n\n${fence("import useSWR from 'swr/immutable'\nconst a = useSWR('/api', fetcher, {}, extra)")}`,
    );
    expect(doc.claims.filter((c) => c.rule)).toEqual([]);
    expect(doc.claims.filter((c) => c.specRef?.export === 'default')).toEqual([]);
  });
});

describe('a callee declared in the fence shadows the export of the same name', () => {
  function storeSpec(): ApiSpec {
    const param = { name: 'api', required: true, schema: { 'x-ts-type': 'unknown' } };
    return {
      meta: { name: 'zustand' },
      exports: [
        {
          id: 'useStore',
          name: 'useStore',
          kind: 'function',
          signatures: [{ parameters: [param] }],
        },
        {
          id: 'Provider',
          name: 'Provider',
          kind: 'function',
          signatures: [{ parameters: [param] }],
        },
      ],
    };
  }

  function storeRules(code: string) {
    const spec = storeSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/context.md',
      content: `# Context\n\n\`\`\`tsx\n${code}\n\`\`\`\n\nLater:\n\n\`\`\`ts\nimport { useStore } from 'zustand'\n\`\`\`\n`,
    })
      .claims.filter((c) => c.rule)
      .map((c) => c.text);
  }

  test('destructured, const, function and parameter declarations', () => {
    expect(
      storeRules('const { Provider, useStore } = createContext()\nconst state = useStore()'),
    ).toEqual([]);
    expect(storeRules('const useStore = create(fn)\nconst state = useStore()')).toEqual([]);
    expect(storeRules('function useStore() {}\nconst state = useStore()')).toEqual([]);
    expect(storeRules('const run = (useStore) => {\n  const s = useStore()\n}')).toEqual([]);
    expect(
      storeRules('const { Provider } = createContext()\nconst el = <Provider>{kids}</Provider>'),
    ).toEqual([]);
  });

  test('the imported export still fires', () => {
    expect(storeRules('const state = useStore()')).toEqual(['useStore()']);
  });
});

describe('a destructured element is bound to its own property type, not the return type', () => {
  const F3 = '```';

  function querySpec(): ApiSpec {
    const ref = (name: string) => ({ $ref: `#/types/${name}` });
    return {
      meta: { name: 'q' },
      exports: [
        {
          id: 'useQuery',
          name: 'useQuery',
          kind: 'function',
          signatures: [{ returns: { schema: ref('Result') } }],
        },
        {
          id: 'usePair',
          name: 'usePair',
          kind: 'function',
          signatures: [
            {
              returns: {
                schema: {
                  type: 'array',
                  prefixItems: [{ type: 'string' }, { anyOf: [{ type: 'null' }, ref('Client')] }],
                },
              },
            },
          ],
        },
        {
          id: 'loadResult',
          name: 'loadResult',
          kind: 'function',
          signatures: [
            {
              returns: {
                schema: { $ref: '#/types/Promise', 'x-ts-type-arguments': [ref('Result')] },
              },
            },
          ],
        },
      ],
      types: [
        {
          id: 'Result',
          name: 'Result',
          kind: 'interface',
          members: [
            { name: 'data', kind: 'property', schema: { 'x-ts-type': 'T' } },
            { name: 'client', kind: 'property', schema: ref('Client') },
            { name: 'meta', kind: 'property', schema: ref('Meta') },
            { name: 'refetch', kind: 'method', signatures: [{ parameters: [] }] },
          ],
        },
        {
          id: 'Client',
          name: 'Client',
          kind: 'class',
          members: [{ name: 'close', kind: 'method', signatures: [{ parameters: [] }] }],
        },
        // Generic alias: members are known, the list is not closed.
        {
          id: 'Meta',
          name: 'Meta',
          kind: 'type',
          typeParameters: [{ name: 'T' }],
          schema: { type: 'object', properties: { tag: { type: 'string' } } },
        },
      ],
    };
  }

  function queryRules(code: string) {
    const spec = querySpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/query.md',
      content: `# Query\n\n${F3}ts\nimport { useQuery, usePair, loadResult } from 'q'\n${code}\n${F3}\n`,
    })
      .claims.filter((c) => c.rule && c.rule.type !== 'spec-not-in-claims')
      .map((c) => [c.rule?.type, c.specRef?.export, c.specRef?.member, c.text]);
  }

  test('the whole value is the return type', () => {
    expect(queryRules('const result = useQuery()\nresult.refetch(1, 2)\nresult.nope()')).toEqual([
      ['prose-arity-mismatch', 'Result', 'refetch', 'result.refetch(1, 2)'],
      ['prose-unresolved-member', undefined, undefined, 'result.nope()'],
    ]);
  });

  test('an element whose property type is not a closed spec type is unbound', () => {
    expect(queryRules('const { data } = useQuery()\ndata.refetch(1, 2)\ndata.nope()')).toEqual([]);
    expect(queryRules('const { refetch } = useQuery()\nrefetch.nope()')).toEqual([]);
    expect(queryRules('const { meta } = useQuery()\nmeta.nope()')).toEqual([]);
    expect(queryRules('const { missing } = useQuery()\nmissing.refetch(1, 2)')).toEqual([]);
    expect(queryRules('const [name] = usePair()\nname.close(1)\nname.nope()')).toEqual([]);
    expect(queryRules('const [a] = useQuery()\na.refetch(1, 2)\na.nope()')).toEqual([]);
  });

  test('an element is bound to the closed spec type of its property', () => {
    expect(queryRules('const { client } = useQuery()\nclient.close(1)\nclient.nope()')).toEqual([
      ['prose-arity-mismatch', 'Client', 'close', 'client.close(1)'],
      ['prose-unresolved-member', undefined, undefined, 'client.nope()'],
    ]);
    expect(queryRules('const { client } = await loadResult()\nclient.close(1)')).toEqual([
      ['prose-arity-mismatch', 'Client', 'close', 'client.close(1)'],
    ]);
  });

  test('renames and defaults bind the local name to the property type', () => {
    expect(queryRules('const { client: c } = useQuery()\nc.close(1)\nclient.close(1)')).toEqual([
      ['prose-arity-mismatch', 'Client', 'close', 'c.close(1)'],
    ]);
    expect(queryRules('const { client = fallback } = useQuery()\nclient.close(1)')).toEqual([
      ['prose-arity-mismatch', 'Client', 'close', 'client.close(1)'],
    ]);
  });

  test('a tuple element is bound by position; rest elements never', () => {
    expect(queryRules('const [name, client] = usePair()\nclient.close(1)\nname.close(1)')).toEqual([
      ['prose-arity-mismatch', 'Client', 'close', 'client.close(1)'],
    ]);
    expect(queryRules('const [, c] = usePair()\nc.close(1)')).toEqual([
      ['prose-arity-mismatch', 'Client', 'close', 'c.close(1)'],
    ]);
    expect(queryRules('const [name, ...rest] = usePair()\nrest.close(1)')).toEqual([]);
    expect(queryRules('const { data, ...rest } = useQuery()\nrest.refetch(1, 2)')).toEqual([]);
  });

  test('a redeclared name drops the earlier binding', () => {
    expect(
      queryRules('const data = useQuery()\n{\n  const { data } = useQuery()\n  data.nope()\n}'),
    ).toEqual([]);
  });
});

describe('fence inventory claims are located inside their own fence', () => {
  const F3 = '```';

  function hookSpec(): ApiSpec {
    return {
      meta: { name: 'q' },
      exports: [
        { id: 'useQuery', name: 'useQuery', kind: 'function' },
        { id: 'Client', name: 'Client', kind: 'class' },
      ],
    };
  }

  function inline(content: string, name = 'useQuery') {
    const spec = hookSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/guide.md',
      content,
    })
      .claims.filter((c) => c.kind === 'inline' && c.specRef?.export === name)
      .map((c) => [c.text, c.candidate, c.locator.start.line, c.locator.start.col]);
  }

  test('not on an earlier prose mention; one claim per fence', () => {
    const content = [
      '# Guide',
      '',
      'Intro mentions useQuery here.',
      '',
      `${F3}ts`,
      'const q = useQuery()',
      F3,
      '',
      '## Later',
      '',
      `${F3}ts`,
      "import { useQuery } from 'q'",
      F3,
      '',
      `${F3}tsx`,
      'function Demo() {',
      '  const a = useQuery()',
      '  return useQuery()',
      '}',
      F3,
      '',
    ].join('\n');
    expect(inline(content)).toEqual([
      ['useQuery', true, 6, 11],
      ['useQuery', true, 12, 10],
      ['useQuery', true, 17, 13],
    ]);
    const spec = hookSpec();
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/guide.md',
      content,
    });
    expect(doc.claims.find((c) => c.locator.start.line === 12)?.locator.headingText).toBe('Later');
    expect(doc.claims.filter((c) => c.kind === 'prose').map((c) => c.locator.start.line)).toEqual([
      3,
    ]);
  });

  test('the call is preferred to the import; `new` and a printed signature count', () => {
    expect(
      inline(`# G\n\n${F3}ts\nimport { useQuery } from 'q'\nconst q = useQuery()\n${F3}\n`),
    ).toEqual([['useQuery', true, 5, 11]]);
    expect(inline(`# G\n\n${F3}ts\nconst c = new Client()\n${F3}\n`, 'Client')).toEqual([
      ['Client', true, 4, 15],
    ]);
    expect(inline(`# G\n\n${F3}ts\nuseQuery(key: string): Result\n${F3}\n`)).toEqual([
      ['useQuery', true, 4, 1],
    ]);
  });

  test('an indented fence in a list keeps its columns', () => {
    expect(inline(`# G\n\n- step\n\n  ${F3}ts\n  const q = useQuery()\n  ${F3}\n`)).toEqual([
      ['useQuery', true, 6, 13],
    ]);
  });

  test("another library's import, or a name the fence declares, is not the export", () => {
    expect(inline(`# G\n\n${F3}ts\nimport { useQuery } from 'other-lib'\n${F3}\n`)).toEqual([]);
    expect(inline(`# G\n\n${F3}ts\nfunction useQuery() {}\nuseQuery()\n${F3}\n`)).toEqual([]);
  });
});

describe('a bare English word is not an export', () => {
  function codecSpec(): ApiSpec {
    const fn = (name: string) => ({ id: name, name, kind: 'function' });
    return {
      meta: { name: 'codecs' },
      exports: [
        ...['base64', 'base64url', 'utf8', 'sha256', 'md5', 'int32', 'h1', 'JSON', 'URL'].map(fn),
        ...['base64urlToBytes', 'ZodType', 'SWRConfig', 'unstable_serialize', 'useSWR'].map(fn),
        { ...fn('default'), signatures: [{ parameters: [] }] },
      ],
    };
  }

  function refs(content: string, kind?: string) {
    const spec = codecSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/codecs.md',
      content,
    })
      .claims.filter((c) => c.specRef && (!kind || c.kind === kind))
      .map((c) => `${c.kind}:${c.specRef?.export}`);
  }

  test('a digit alone does not make a bare word an export', () => {
    expect(
      refs(
        '# Codecs\n\nConverts base64url strings (URL-safe base64) to `Uint8Array` byte arrays.\n\nUse utf8, sha256, md5, int32 or an h1 with JSON over a URL.\n',
      ),
    ).toEqual([]);
  });

  test('camelCase, multi-hump PascalCase and snake_case bare words still match', () => {
    expect(
      refs(
        '# Codecs\n\nThe base64urlToBytes codec returns a ZodType.\n\nWrap it in SWRConfig and call unstable_serialize from useSWR.\n',
      ),
    ).toEqual([
      'prose:base64urlToBytes',
      'prose:ZodType',
      'prose:SWRConfig',
      'prose:unstable_serialize',
      'prose:useSWR',
    ]);
  });

  test('backticked names are unaffected', () => {
    expect(refs('# Codecs\n\nUse `base64` or `utf8()` here.\n', 'inline')).toEqual([
      'inline:base64',
      'inline:utf8',
    ]);
  });

  test('the word `default` never names the default export', () => {
    expect(
      refs(
        '# Codecs\n\nThe `default` value is 3, and default is the default.\n\n## default\n\n| Key | Notes |\n| --- | --- |\n| `default` | the `default()` |\n',
      ),
    ).toEqual([]);
  });
});

describe('the default export answers to its source name (`localName`)', () => {
  const F3 = '```';
  const any = { 'x-ts-type': 'unknown' };

  function swrSpec(localName: string | undefined = 'useSWR'): ApiSpec {
    return {
      meta: { name: 'swr' },
      exports: [
        {
          id: 'default',
          name: 'default',
          ...(localName ? { localName } : {}),
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'key', required: true, schema: any },
                { name: 'fetcher', required: false, schema: any },
              ],
            },
          ],
        },
        { id: 'mutate', name: 'mutate', kind: 'function' },
      ],
    };
  }

  function swrDoc(content: string, localName?: string) {
    const spec = swrSpec(localName);
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/api.md',
      content,
    });
  }

  function bound(content: string, localName?: string) {
    return swrDoc(content, localName)
      .claims.filter((c) => c.specRef?.export === 'default')
      .map((c) => [c.kind, c.rule?.type ?? null, c.locator.start.line, c.locator.start.col]);
  }

  test('the registry exposes it without making it an export name', () => {
    const registry = buildExportRegistry(swrSpec());
    expect(registry.localNames?.get('useSWR')).toBe('default');
    expect(registry.all.has('useSWR')).toBe(false);
    expect(buildExportRegistry(swrSpec('')).localNames?.size).toBe(0);
  });

  test('backticked prose, bare-word prose, headings and table keys resolve to `default`', () => {
    const content = [
      '# API',
      '',
      '## useSWR',
      '',
      'Call `useSWR(key, fetcher)` in a component.',
      '',
      'Every useSWR call shares a cache.',
      '',
      '## Options',
      '',
      '| Name | Notes |',
      '| --- | --- |',
      '| `useSWR` | the hook |',
      '',
    ].join('\n');
    expect(bound(content)).toEqual([
      ['table-key', null, 13, 3],
      ['inline', null, 5, 6],
      ['heading', null, 3, 4],
      ['prose', null, 5, 1],
      ['prose', null, 7, 1],
      ['prose', null, 13, 3],
    ]);
    expect(swrDoc(content).slices.map((s) => s.export)).toEqual(['default']);
  });

  test('a fence call with no visible import is the default export: inventory and rules', () => {
    const content = `# API\n\n${F3}tsx\nconst { data } = useSWR('/api/user', fetcher)\n${F3}\n\n${F3}tsx\nconst a = useSWR()\nconst b = useSWR(k, f, {}, extra)\n${F3}\n`;
    expect(bound(content)).toEqual([
      ['fence', 'prose-missing-required', 8, 11],
      ['fence', 'prose-arity-mismatch', 9, 11],
      ['inline', null, 4, 18],
    ]);
    expect(swrDoc(content).claims.find((c) => c.rule)?.rule?.issue).toBe(
      "Call 'useSWR' is missing required argument 'key'",
    );
  });

  test('a default import under another local name still binds that local', () => {
    const content = `# API\n\n${F3}tsx\nimport swr from 'swr'\nconst a = swr()\n${F3}\n`;
    expect(bound(content)).toEqual([['fence', 'prose-missing-required', 5, 11]]);
  });

  test('the name imported from anywhere else, or declared in the fence, is not the default export', () => {
    expect(
      bound(`# API\n\n${F3}tsx\nimport useSWR from 'swr/immutable'\nconst a = useSWR()\n${F3}\n`),
    ).toEqual([]);
    expect(
      bound(`# API\n\n${F3}tsx\nimport { useSWR } from './hooks'\nconst a = useSWR()\n${F3}\n`),
    ).toEqual([]);
    expect(bound(`# API\n\n${F3}tsx\nconst useSWR = wrap()\nconst a = useSWR()\n${F3}\n`)).toEqual(
      [],
    );
  });

  test('`import { useSWR }` is still a broken reference, and says why', () => {
    const hit = swrDoc(`# API\n\n${F3}tsx\nimport { useSWR } from 'swr'\n${F3}\n`).claims.find(
      (c) => c.rule,
    );
    expect(hit?.rule?.type).toBe('prose-broken-reference');
    expect(hit?.rule?.suggestion).toBe("'useSWR' is the default export: import useSWR from 'swr'");
  });

  test('no localName in the spec: nothing resolves by that name', () => {
    expect(
      bound(`# API\n\nCall \`useSWR()\`.\n\n${F3}tsx\nconst a = useSWR()\n${F3}\n`, ''),
    ).toEqual([]);
  });
});

describe('a backticked `.name()` is a member, or nothing', () => {
  function schemaSpec(): ApiSpec {
    const method = (name: string, inheritedFrom?: string) => ({
      name,
      kind: 'method',
      ...(inheritedFrom ? { inheritedFrom } : {}),
      signatures: [{ parameters: [] }],
    });
    return {
      meta: { name: 'schemas' },
      exports: [
        {
          id: 'meta',
          name: 'meta',
          kind: 'function',
          signatures: [{ parameters: [{ name: 'metadata', required: true, schema: 'unknown' }] }],
        },
        { id: 'BaseType', name: 'BaseType', kind: 'class', members: [method('meta')] },
        // An alias of the ancestor is the ancestor.
        {
          id: 'AnyType',
          name: 'AnyType',
          kind: 'type',
          schema: { 'x-ts-type': 'BaseType<Output, Input>' },
          members: [method('meta')],
        },
        {
          id: 'StringType',
          name: 'StringType',
          kind: 'class',
          members: [
            method('meta', 'BaseType'),
            method('trim'),
            method('size'),
            method('safeParse'),
          ],
        },
        {
          id: 'NumberType',
          name: 'NumberType',
          kind: 'class',
          members: [method('meta', 'BaseType'), method('size'), method('safeParse')],
        },
        // Flattened interface: `meta` is a schema property, reached through a base that lists nothing.
        {
          id: 'IntType',
          name: 'IntType',
          kind: 'interface',
          extends: 'NumberFormat<T>',
          schema: { type: 'object', properties: { meta: {} } },
        },
        { id: 'NumberFormat', name: 'NumberFormat', kind: 'interface', extends: 'NumberType' },
        {
          id: 'util',
          name: 'util',
          kind: 'namespace',
          members: [{ name: 'trim', kind: 'function' }],
        },
        { id: 'trim', name: 'trim', kind: 'function' },
        { id: 'safeParse', name: 'safeParse', kind: 'function' },
      ],
    };
  }

  function refs(content: string) {
    const spec = schemaSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/metadata.md',
      content,
    })
      .claims.filter((c) => c.candidate)
      .map((c) => `${c.kind}:${c.specRef?.export}.${c.specRef?.member ?? ''}`);
  }

  test('never the top-level export of that name', () => {
    expect(refs('# Metadata\n\nThe `trim` function and the `meta(data)` function.\n')).toEqual([
      'inline:trim.',
      'inline:meta.',
      'prose:trim.',
      'prose:meta.',
    ]);
    expect(refs('# Metadata\n\nCalling `.trim()` strips whitespace.\n')).toEqual([
      'inline:StringType.trim',
      'prose:StringType.trim',
    ]);
  });

  test('inherited everywhere from one ancestor: that ancestor', () => {
    expect(
      refs('# Metadata\n\nCalling `.meta()` without an argument will *retrieve* the metadata.\n'),
    ).toEqual(['inline:BaseType.meta', 'prose:BaseType.meta']);
  });

  test('several unrelated owners and no heading: no claim', () => {
    expect(refs('# Metadata\n\nUse `.size()` to constrain it, or `.nope()`.\n')).toEqual([]);
    // A distinctive name is not picked up as a bare word either.
    expect(refs('# Metadata\n\nUse `.safeParse()` or `schema.safeParse(data)`.\n')).toEqual([]);
    expect(refs('# Metadata\n\nThe safeParse function never throws.\n')).toEqual([
      'prose:safeParse.',
    ]);
  });

  test('a heading that names a type disambiguates', () => {
    expect(refs('# Metadata\n\n## NumberType\n\nUse `.size()` and `.meta()` here.\n')).toEqual([
      'inline:NumberType.size',
      'inline:NumberType.meta',
      'heading:NumberType.',
      'prose:NumberType.size',
      'prose:NumberType.meta',
    ]);
  });
});

describe('prose-deprecated-reference judges the resolved reference, never a bare name', () => {
  const F3 = '```';

  function zodLike(): ApiSpec {
    const ref = (name: string) => ({ $ref: `#/types/${name}` });
    const note = [{ name: 'deprecated', text: 'Use `z.url()` instead.' }];
    return {
      meta: { name: 'zod' },
      exports: [
        {
          id: 'url',
          name: 'url',
          kind: 'function',
          signatures: [{ returns: { schema: ref('ZodURL') } }],
        },
        {
          id: 'string',
          name: 'string',
          kind: 'function',
          signatures: [{ returns: { schema: ref('ZodString') } }],
        },
        {
          id: 'oldString',
          name: 'oldString',
          kind: 'function',
          deprecated: true,
          tags: [{ name: 'deprecated', text: 'Use `z.string()` instead.' }],
        },
        {
          id: 'ZodString',
          name: 'ZodString',
          kind: 'class',
          members: [
            { name: 'url', kind: 'method', deprecated: true, tags: note },
            {
              name: 'min',
              kind: 'method',
              signatures: [{ returns: { schema: { 'x-ts-type': 'this' } } }],
            },
            { name: 'unwrap', kind: 'method', signatures: [{ returns: { schema: 'unknown' } }] },
          ],
        },
        { id: 'ZodURL', name: 'ZodURL', kind: 'class', members: [{ name: 'min', kind: 'method' }] },
      ],
    };
  }

  function deprecated(code: string, imp = "import * as z from 'zod'") {
    const spec = zodLike();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/api.md',
      content: `# API\n\n${F3}ts\n${imp}\n${code}\n${F3}\n`,
    })
      .claims.filter((c) => c.rule?.type === 'prose-deprecated-reference')
      .map((c) => [c.specRef?.export, c.specRef?.member, c.locator.start.line, c.text]);
  }

  test('`ns.name()` is the top-level export, deprecated only if that export is', () => {
    expect(deprecated('const a = z.url()\nz.url().min(1)')).toEqual([]);
    expect(deprecated('const a = url()', "import { url } from 'zod'")).toEqual([]);
    expect(deprecated('const a = url()', '')).toEqual([]);
    expect(deprecated('const a = z.oldString()')).toEqual([
      ['oldString', undefined, 5, 'z.oldString()'],
    ]);
  });

  test('a member through a real binding is a hit, on the owning type', () => {
    expect(deprecated('const s = z.string()\ns.url()')).toEqual([
      ['ZodString', 'url', 6, 's.url()'],
    ]);
    expect(deprecated('function f(s: ZodString) {\n  return s.url()\n}')).toEqual([
      ['ZodString', 'url', 6, 's.url()'],
    ]);
  });

  test('a chain resolved through spec return types is a hit', () => {
    expect(deprecated('const a = z.string().url()')).toEqual([['ZodString', 'url', 5, 'url']]);
    expect(deprecated('const a = z.string().min(5).url()')).toEqual([
      ['ZodString', 'url', 5, 'url'],
    ]);
    expect(deprecated('const a = string().url()', "import { string } from 'zod'")).toEqual([
      ['ZodString', 'url', 5, 'url'],
    ]);
  });

  test("a member the receiver's type lacks is never cited on another type that has it", () => {
    const spec = zodLike();
    const hit = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/api.md',
      content: `# API\n\n${F3}ts\nimport * as z from 'zod'\nconst u = z.url()\nu.unwrap()\n${F3}\n`,
    }).claims.find((c) => c.rule?.type === 'prose-unresolved-member');
    expect(hit?.specRef).toBeNull();
    expect(hit?.rule?.issue).toBe("Method 'unwrap' called on 'u' does not exist on 'ZodURL'");
    expect(hit?.rule?.suggestion).toBe("'unwrap' is not a member of 'ZodURL'");
  });

  test('an unresolved receiver or chain is silent', () => {
    expect(deprecated('schema.url()')).toEqual([]);
    expect(deprecated('const a = z.string().unwrap().url()')).toEqual([]);
    expect(deprecated('const a = z.string<T>().url()')).toEqual([]);
    expect(deprecated('const a = other().url()')).toEqual([]);
    expect(deprecated('const string = () => x\nconst a = string().url()', '')).toEqual([]);
  });
});

describe("a builtin type name is the language's type, not the export of the same name", () => {
  const F3 = '```';

  function zodLike(): ApiSpec {
    const fn = (name: string) => ({ id: name, name, kind: 'function' });
    return {
      meta: { name: 'zod' },
      exports: [
        ...['number', 'string', 'date', 'map', 'json', 'BigInt', 'RegExp', 'Error'].map(fn),
        fn('strictObject'),
        { id: 'z', name: 'z', kind: 'namespace' },
      ],
    };
  }

  function refs(content: string) {
    const spec = zodLike();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/codecs.md',
      content,
    })
      .claims.filter((c) => c.specRef)
      .map(
        (c) => `${c.kind}:${c.specRef?.export}${c.specRef?.member ? `.${c.specRef.member}` : ''}`,
      );
  }

  const imp = `${F3}ts\nimport * as z from 'zod'\n${F3}\n`;

  test('a plain backticked or bare builtin name is no claim', () => {
    expect(
      refs(
        `# Codecs\n\n${imp}\nConverts string representations of integers to JavaScript \`number\` type using \`parseInt()\`.\n\nA \`Date\`, a \`date\`, a \`map\` of \`string\` to \`json\`, a BigInt or a RegExp, or an \`Error\`.\n\n## number\n\n## Options\n\n| Key | Notes |\n| --- | --- |\n| \`string\` | the \`number\` |\n`,
      ),
    ).toEqual([]);
  });

  test('call form, a namespace or package qualifier, and a code heading name the export', () => {
    expect(refs(`# Codecs\n\n${imp}\nUse \`number()\` or \`string({ min: 1 })\` here.\n`)).toEqual([
      'inline:number',
      'inline:string',
      'prose:number',
      'prose:string',
    ]);
    expect(
      refs(`# Codecs\n\n${imp}\nUse \`z.number\` or \`z.date()\`, or zod.map in prose.\n`),
    ).toEqual(['inline:number', 'inline:date', 'prose:number', 'prose:date', 'prose:map']);
    expect(refs(`# Codecs\n\n${imp}\n## \`number\`\n\n## \`string()\`\n\n## z.date\n`)).toEqual([
      'heading:number',
      'heading:string',
      'heading:date',
    ]);
  });

  test('a namespace-qualified name is that export, never a member of the namespace', () => {
    expect(
      refs(`# Codecs\n\n${imp}\n## z.strictObject\n\nUse \`z.strictObject()\` and \`z.nope()\`.\n`),
    ).toEqual(['inline:strictObject', 'heading:strictObject', 'prose:strictObject']);
  });

  test('fence call sites and imports are unaffected', () => {
    expect(
      refs(
        `# Codecs\n\n${F3}ts\nimport { number } from 'zod'\nconst n = number()\nconst s = string()\n${F3}\n`,
      ),
    ).toEqual(['inline:number', 'inline:string']);
  });
});

describe('one page, several specs of the same package (`alsoSpecs`)', () => {
  const F3 = '```';
  const ref = (name: string) => ({ $ref: `#/types/${name}` });
  const param = (name: string, required = true) => ({ name, required, schema: 'unknown' });
  const method = (name: string, parameters: ReturnType<typeof param>[]) => ({
    name,
    kind: 'method',
    signatures: [{ parameters }],
  });
  const parse = {
    id: 'parse',
    name: 'parse',
    kind: 'function',
    signatures: [{ parameters: [param('schema'), param('data')] }],
  };

  function zodSpec(): ApiSpec {
    return {
      meta: { name: 'zod' },
      exports: [
        {
          id: 'string',
          name: 'string',
          kind: 'function',
          signatures: [
            { parameters: [param('params', false)], returns: { schema: ref('ZodString') } },
          ],
        },
        {
          id: 'object',
          name: 'object',
          kind: 'function',
          signatures: [{ parameters: [param('shape')] }],
        },
        parse,
        {
          id: 'ZodString',
          name: 'ZodString',
          kind: 'class',
          members: [method('min', [param('n')])],
        },
      ],
    };
  }

  function miniSpec(): ApiSpec {
    return {
      meta: { name: 'zod' },
      exports: [
        {
          id: 'string',
          name: 'string',
          kind: 'function',
          signatures: [
            { parameters: [param('params', false)], returns: { schema: ref('ZodMiniString') } },
          ],
        },
        {
          id: 'minimum',
          name: 'minimum',
          kind: 'function',
          signatures: [{ parameters: [param('value'), param('params', false)] }],
        },
        parse,
        {
          id: 'ZodMiniString',
          name: 'ZodMiniString',
          kind: 'class',
          members: [method('check', [param('check')])],
        },
      ],
    };
  }

  function hits(content: string, withMini = true) {
    const spec = zodSpec();
    const mini = miniSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/api.md',
      content,
      ...(withMini
        ? {
            alsoSpecs: [
              { spec: mini, registry: buildExportRegistry(mini), importSpecifier: 'zod/mini' },
            ],
          }
        : {}),
    })
      .claims.filter((c) => c.rule)
      .map((c) => [c.rule?.type, c.specRef?.export ?? null, c.specRef?.member ?? null, c.text]);
  }

  const zodImport = `${F3}ts\nimport * as z from 'zod'\n${F3}\n`;
  const fence = (code: string) => `${F3}ts\n${code}\n${F3}\n`;

  test('a name only a secondary spec has is not a broken reference', () => {
    const content = `# API\n\n${zodImport}\n${fence('z.string().check(z.minimum(5))')}\n${fence("import { minimum, nope } from 'zod'")}\n${fence('z.nope()')}`;
    expect(hits(content, false)).toEqual([
      ['prose-broken-reference', null, null, 'z.minimum(5)'],
      ['prose-broken-reference', null, null, 'minimum'],
      ['prose-broken-reference', null, null, 'nope'],
      ['prose-broken-reference', null, null, 'z.nope()'],
    ]);
    expect(hits(content)).toEqual([
      ['prose-broken-reference', null, null, 'nope'],
      ['prose-broken-reference', null, null, 'z.nope()'],
    ]);
  });

  test("a fence that imports a secondary's specifier is checked against that spec", () => {
    const code = [
      "import * as z from 'zod/mini'",
      'const a = z.minimum()',
      'const s = z.string()',
      'const c = s.check()',
      's.min(5)',
      'z.object({})',
      'z.nope()',
    ].join('\n');
    expect(hits(`# API\n\n${fence(code)}`)).toEqual([
      ['prose-missing-required', 'minimum', null, 'z.minimum()'],
      ['prose-missing-required', 'ZodMiniString', 'check', 's.check()'],
      ['prose-unresolved-member', null, null, 's.min(5)'],
      ['prose-broken-reference', null, null, 'z.nope()'],
    ]);
    // Without the secondary spec the fence is another module's: nothing is checked.
    expect(hits(`# API\n\n${fence(code)}`, false)).toEqual([]);
  });

  test('a named import from the secondary specifier is checked against it', () => {
    expect(
      hits(
        `# API\n\n${fence("import { minimum, object, nope } from 'zod/mini'\nconst m = minimum()")}`,
      ),
    ).toEqual([
      ['prose-broken-reference', null, null, 'nope'],
      ['prose-missing-required', 'minimum', null, 'minimum()'],
    ]);
  });

  test('no import and a name whose signature differs between the specs: silent', () => {
    const content = `# API\n\n${zodImport}\n${fence('const s = z.string(1, 2)\nconst m = s.min()\ns.nope()\nconst p = z.parse()')}`;
    expect(hits(content, false)).toEqual([
      ['prose-arity-mismatch', 'string', null, 'z.string(1, 2)'],
      ['prose-missing-required', 'ZodString', 'min', 's.min()'],
      ['prose-unresolved-member', null, null, 's.nope()'],
      ['prose-missing-required', 'parse', null, 'z.parse()'],
    ]);
    // `parse` is the same in both specs; `string` is not.
    expect(hits(content)).toEqual([['prose-missing-required', 'parse', null, 'z.parse()']]);
  });

  test("a fence that imports the primary is the primary's, whatever the secondary has", () => {
    const code = "import * as z from 'zod'\nconst s = z.string(1, 2)\nconst m = s.min()";
    expect(hits(`# API\n\n${fence(code)}`)).toEqual([
      ['prose-arity-mismatch', 'string', null, 'z.string(1, 2)'],
      ['prose-missing-required', 'ZodString', 'min', 's.min()'],
    ]);
  });

  test("a secondary fence's mentions are that entry's exports", () => {
    const spec = zodSpec();
    const mini = miniSpec();
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/api.md',
      content: `# API\n\n${fence("import { minimum } from 'zod/mini'\nconst m = minimum(5)")}`,
      alsoSpecs: [{ spec: mini, registry: buildExportRegistry(mini), importSpecifier: 'zod/mini' }],
    });
    expect(doc.claims.map((c) => [c.kind, c.specRef?.signature, c.locator.start.line])).toEqual([
      ['inline', 'minimum(value: unknown, params?: unknown)', 5],
    ]);
    expect(doc.slices.map((sl) => sl.export)).toEqual(['minimum']);
  });

  test('buildPageDocuments forwards it', () => {
    const spec = zodSpec();
    const mini = miniSpec();
    const [doc] = buildPageDocuments({
      spec,
      registry: buildExportRegistry(spec),
      alsoSpecs: [{ spec: mini, registry: buildExportRegistry(mini), importSpecifier: 'zod/mini' }],
      files: [{ file: 'docs/api.md', content: `# API\n\n${zodImport}\n${fence('z.minimum(5)')}` }],
    });
    expect(doc.claims.filter((c) => c.rule)).toEqual([]);
  });
});

describe('a type `$ref` resolves by id first, then by an unambiguous name', () => {
  const F3 = '```';

  function optionsSpec(withPlainId = true): ApiSpec {
    const options = (id: string, keys: string[]) => ({
      id,
      name: 'Options',
      kind: 'interface',
      schema: { type: 'object', properties: Object.fromEntries(keys.map((k) => [k, {}])) },
    });
    const fn = (name: string, ref: string) => ({
      id: name,
      name,
      kind: 'function',
      signatures: [
        { parameters: [{ name: 'options', required: true, schema: { $ref: `#/types/${ref}` } }] },
      ],
    });
    return {
      meta: { name: 'pkg' },
      exports: [
        fn('createStore', 'Options'),
        fn('useStore', 'react.Options'),
        fn('open', 'Config'),
      ],
      types: [
        options(withPlainId ? 'Options' : 'vanilla.Options', ['name', 'devtools']),
        options('react.Options', ['selector', 'suspense']),
        {
          id: 'core.Config',
          name: 'Config',
          kind: 'interface',
          schema: { type: 'object', properties: { url: {} } },
        },
      ],
    };
  }

  function unknownKeys(code: string, withPlainId = true) {
    const spec = optionsSpec(withPlainId);
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/store.md',
      content: `# Store\n\n${F3}ts\n${code}\n${F3}\n`,
    })
      .claims.filter((c) => c.rule)
      .map((c) => [c.rule?.type, c.rule?.issue, c.rule?.suggestion]);
  }

  test('`#/types/Options` is the entry with that id: the other Options keys are unknown', () => {
    expect(unknownKeys("const s = createStore({ name: 'a', devtools: true })")).toEqual([]);
    expect(unknownKeys("const s = createStore({ name: 'a', suspense: true })")).toEqual([
      ['prose-unknown-key', "Unknown key 'suspense' on 'createStore'", 'Allowed: devtools, name'],
    ]);
  });

  test('`#/types/react.Options` is checked against that one', () => {
    expect(unknownKeys('const s = useStore({ selector, suspense: true })')).toEqual([]);
    expect(unknownKeys("const s = useStore({ selector, name: 'a' })")).toEqual([
      ['prose-unknown-key', "Unknown key 'name' on 'useStore'", 'Allowed: selector, suspense'],
    ]);
  });

  test('a name only one entry has resolves whatever its id', () => {
    expect(unknownKeys("const c = open({ uri: 'x' })")).toEqual([
      ['prose-unknown-key', "Unknown key 'uri' on 'open'", 'Allowed: url'],
    ]);
  });

  test('several same-named entries and no id match: unresolved, no claim', () => {
    expect(unknownKeys("const s = createStore({ name: 'a', bogus: true })", false)).toEqual([]);
  });
});

describe('a name the page declares shadows the export of the same name in later fences', () => {
  const F3 = '```';

  function storeSpec(): ApiSpec {
    const param = (name: string) => ({ name, required: true, schema: { 'x-ts-type': 'unknown' } });
    return {
      meta: { name: 'zustand' },
      exports: [
        {
          id: 'useStore',
          name: 'useStore',
          kind: 'function',
          signatures: [
            {
              parameters: [param('api'), param('selector')],
              returns: { schema: { $ref: '#/types/StoreApi' } },
            },
          ],
        },
        {
          id: 'create',
          name: 'create',
          kind: 'function',
          signatures: [{ parameters: [param('initializer')] }],
        },
        {
          id: 'StoreApi',
          name: 'StoreApi',
          kind: 'interface',
          members: [{ name: 'getState', kind: 'method' }],
        },
      ],
    };
  }

  function storePage(...fences: string[]) {
    const spec = storeSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/use-shallow.md',
      content: `# useShallow\n\n${fences.map((f) => `${F3}tsx\n${f}\n${F3}\n`).join('\nThen:\n\n')}`,
    });
  }

  function useStoreClaims(...fences: string[]) {
    return storePage(...fences)
      .claims.filter((c) => c.specRef?.export === 'useStore')
      .map((c) => [c.rule?.type ?? 'candidate', c.text, c.locator.start.line]);
  }

  const BOUND = 'const useStore = create<State>((set) => ({}))';
  const CALL = 'const searchValue = useStore((state) => state.searchValue)';

  test("the reader's own bound hook is not the export: no rule, no inventory claim", () => {
    expect(useStoreClaims(BOUND, CALL)).toEqual([]);
  });

  test('function, class, let and destructured declarations shadow too', () => {
    expect(useStoreClaims('function useStore(sel) {}', CALL)).toEqual([]);
    expect(useStoreClaims('let useStore', CALL)).toEqual([]);
    expect(useStoreClaims('const { useStore } = createContext()', CALL)).toEqual([]);
    expect(useStoreClaims('const [useStore] = createHooks()', CALL)).toEqual([]);
    expect(useStoreClaims('export const useStore = create(fn)', CALL)).toEqual([]);
  });

  test('a later fence that re-imports the name rebinds it to the export, from that fence on', () => {
    expect(
      useStoreClaims(BOUND, CALL, `import { useStore } from 'zustand'\n\n${CALL}`, CALL),
    ).toEqual([
      ['prose-missing-required', 'useStore((state) => state.searchValue)', 18],
      ['prose-missing-required', 'useStore((state) => state.searchValue)', 24],
    ]);
  });

  test('a declaration nested in a function body is not page scope', () => {
    expect(useStoreClaims('function App() {\n  const useStore = make()\n}', CALL)).toEqual([
      ['prose-missing-required', 'useStore((state) => state.searchValue)', 12],
    ]);
  });

  test('a printed signature of the export is not a shadow', () => {
    const hit = [['prose-missing-required', 'useStore((state) => state.searchValue)', 11]];
    const signature = 'function useStore<S, U>(\n  api: S,\n  selector: (state: S) => U\n): U';
    expect(useStoreClaims(signature, CALL).slice(-1)).toEqual([
      ['prose-missing-required', 'useStore((state) => state.searchValue)', 13],
    ]);
    expect(
      useStoreClaims('declare const useStore: Hook\ndeclare function create(): void', CALL),
    ).toEqual(hit);
  });

  test('a fence before the declaration is still the export', () => {
    expect(useStoreClaims(CALL, BOUND)).toEqual([
      ['prose-missing-required', 'useStore((state) => state.searchValue)', 4],
    ]);
  });

  test('a variable bound to the shadowed callee is not typed by the export', () => {
    const doc = storePage(BOUND, 'const api = useStore(sel)\napi.bogus()');
    expect(doc.claims.filter((c) => c.rule).map((c) => c.rule?.type)).toEqual([]);
  });

  test('the deprecated check follows the same scope: shadowed, then re-imported', () => {
    const spec = storeSpec();
    spec.exports.push({
      id: 'createContext',
      name: 'createContext',
      kind: 'function',
      deprecated: true,
      signatures: [{ parameters: [] }],
    });
    const deprecated = (...fences: string[]) =>
      buildPageDocument({
        spec,
        registry: buildExportRegistry(spec),
        file: 'docs/context.md',
        content: `# Context\n\n${fences.map((f) => `${F3}ts\n${f}\n${F3}\n`).join('\nThen:\n\n')}`,
      })
        .claims.filter((c) => c.rule?.type === 'prose-deprecated-reference')
        .map((c) => c.locator.start.line);
    const own = 'const createContext = () => ({})';
    expect(deprecated(own, 'const ctx = createContext()')).toEqual([]);
    expect(
      deprecated(own, "import { createContext } from 'zustand'\n\nconst ctx = createContext()"),
    ).toEqual([10]);
  });
});

describe('an owner outside the public surface does not make a `.member()` ambiguous', () => {
  function parseSpec(): ApiSpec {
    const method = (name: string, inheritedFrom?: string) => ({
      name,
      kind: 'method',
      ...(inheritedFrom ? { inheritedFrom } : {}),
      signatures: [{ parameters: [] }],
    });
    const internal = (name: string) => ({
      id: name,
      name,
      kind: 'interface',
      members: [method('parse'), method('run')],
    });
    return {
      meta: { name: 'schemas' },
      exports: [
        { id: 'BaseType', name: 'BaseType', kind: 'class', members: [method('parse')] },
        {
          id: 'StringType',
          name: 'StringType',
          kind: 'class',
          members: [method('parse', 'BaseType'), method('encode')],
        },
        {
          id: 'string',
          name: 'string',
          kind: 'function',
          signatures: [{ parameters: [], returns: { schema: { $ref: '#/types/StringType' } } }],
        },
        {
          id: 'codec',
          name: 'codec',
          kind: 'function',
          signatures: [
            {
              parameters: [{ name: 'options', schema: { $ref: '#/types/CodecOptions' } }],
              returns: { schema: { anyOf: [{ $ref: '#/types/Codec' }, { type: 'null' }] } },
            },
          ],
        },
      ],
      types: [
        internal('$BaseInternals'),
        internal('$StringInternals'),
        internal('_Hidden'),
        // Not exported, not the declared type of any export: an implementation detail.
        { id: 'Runner', name: 'Runner', kind: 'interface', members: [method('run')] },
        { id: 'Worker', name: 'Worker', kind: 'interface', members: [method('run')] },
        // Reachable as the return / parameter type of the export `codec`.
        { id: 'Codec', name: 'Codec', kind: 'interface', members: [method('encode')] },
        {
          id: 'CodecOptions',
          name: 'CodecOptions',
          kind: 'interface',
          members: [method('strict')],
        },
        { id: 'Unreached', name: 'Unreached', kind: 'interface', members: [method('strict')] },
      ],
    };
  }

  function refs(content: string) {
    const spec = parseSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/x.md',
      content,
    })
      .claims.filter((c) => c.candidate && c.kind === 'inline')
      .map((c) => `${c.specRef?.export}.${c.specRef?.member ?? ''}`);
  }

  test('`$`-prefixed and `_`-prefixed internals do not count: `.parse()` is BaseType.parse', () => {
    expect(refs('# Parsing\n\nCall `.parse()` to validate.\n')).toEqual(['BaseType.parse']);
  });

  test('a type an export returns or takes is public; one nothing reaches is not', () => {
    expect(refs('# Options\n\nSet `.strict()` on the options.\n')).toEqual(['CodecOptions.strict']);
  });

  test('two public owners that share no ancestor stay ambiguous', () => {
    expect(refs('# Encoding\n\nCall `.encode()`.\n')).toEqual([]);
  });

  test('no public owner at all: the owners are judged as before', () => {
    expect(refs('# Running\n\nCall `.run()`.\n')).toEqual([]);
  });
});

describe('a namespace-qualified call in a fence is an inventory claim', () => {
  const F3 = '```';
  const ref = (name: string) => ({ $ref: `#/types/${name}` });
  const param = (name: string, required = true) => ({ name, required, schema: 'unknown' });
  const fn = (name: string, returns?: string, parameters = [param('params', false)]) => ({
    id: name,
    name,
    kind: 'function',
    signatures: [{ parameters, ...(returns ? { returns: { schema: ref(returns) } } : {}) }],
  });
  const method = (name: string, returns?: Record<string, unknown>) => ({
    name,
    kind: 'method',
    signatures: [{ parameters: [param('arg', false)], ...(returns ? { returns } : {}) }],
  });

  function zodSpec(): ApiSpec {
    return {
      meta: { name: 'zod' },
      exports: [
        fn('string', 'ZodString'),
        fn('object', undefined, [param('shape')]),
        fn('toJSONSchema', undefined, [param('schema')]),
        fn('number', 'ZodNumber'),
        fn('custom'),
        {
          id: 'ZodString',
          name: 'ZodString',
          kind: 'class',
          members: [
            method('email', { schema: { 'x-ts-type': 'this' } }),
            method('min', { schema: ref('ZodString') }),
            method('optional', { schema: { 'x-ts-type': 'ZodOptional<this>' } }),
            method('parse'),
          ],
        },
        { id: 'ZodNumber', name: 'ZodNumber', kind: 'class', members: [method('int')] },
      ],
    };
  }

  function miniSpec(): ApiSpec {
    return {
      meta: { name: 'zod' },
      exports: [
        fn('string', 'ZodMiniString'),
        fn('minLength'),
        {
          id: 'ZodMiniString',
          name: 'ZodMiniString',
          kind: 'class',
          members: [method('parse'), method('check', { schema: { 'x-ts-type': 'this' } })],
        },
      ],
    };
  }

  function inventory(content: string, withMini = false) {
    const spec = zodSpec();
    const mini = miniSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/api.md',
      content,
      ...(withMini
        ? {
            alsoSpecs: [
              { spec: mini, registry: buildExportRegistry(mini), importSpecifier: 'zod/mini' },
            ],
          }
        : {}),
    })
      .claims.filter((c) => c.candidate && c.kind === 'inline')
      .map((c) => [
        c.text,
        c.specRef?.member ? `${c.specRef.export}.${c.specRef.member}` : c.specRef?.export,
        `${c.locator.start.line}:${c.locator.start.col}-${c.locator.end.col}`,
      ]);
  }

  const fence = (code: string) => `${F3}ts\n${code}\n${F3}\n`;

  test('`ns.f(...)` through an imported alias: one claim per (fence, export), on the first call', () => {
    const code =
      'import * as z from "zod";\n\nconst User = z.object({ name: z.string(), nick: z.string() });\nz.toJSONSchema(User);';
    expect(inventory(`# API\n\n${fence(code)}`)).toEqual([
      ['z.object', 'object', '6:14-21'],
      ['z.string', 'string', '6:31-38'],
      ['z.toJSONSchema', 'toJSONSchema', '7:1-14'],
    ]);
  });

  test("the page's conventional alias, when no import is shown", () => {
    expect(inventory(`# API\n\n${fence('z.object({ a: z.number() });')}`)).toEqual([
      ['z.object', 'object', '4:1-8'],
      ['z.number', 'number', '4:15-22'],
    ]);
  });

  test('not an export, a local of that name, or a lone unknown receiver: no claim', () => {
    expect(inventory(`# API\n\n${fence('import * as z from "zod";\nz.nope();')}`)).toEqual([]);
    expect(inventory(`# API\n\n${fence('const run = (z) => z.string();')}`)).toEqual([]);
    expect(inventory(`# API\n\n${fence('y.string();')}`)).toEqual([]);
  });

  test('a chain resolved through spec return types cites the member, up to the first unknown link', () => {
    const code = 'import * as z from "zod";\n\nz.string().email().min(5).optional().parse(x);';
    expect(inventory(`# API\n\n${fence(code)}`)).toEqual([
      ['z.string', 'string', '6:1-8'],
      ['email', 'ZodString.email', '6:12-16'],
      ['min', 'ZodString.min', '6:20-22'],
      ['optional', 'ZodString.optional', '6:27-34'],
    ]);
  });

  test('a member the resolved type lacks, or an untyped head, is no claim', () => {
    const code = 'import * as z from "zod";\n\nz.number().email();\nz.custom().email();';
    expect(inventory(`# API\n\n${fence(code)}`)).toEqual([
      ['z.number', 'number', '6:1-8'],
      ['z.custom', 'custom', '7:1-8'],
    ]);
  });

  test('a `zod/mini` fence is read against that entry', () => {
    const code = 'import * as z from "zod/mini";\n\nz.string().check(z.minLength(5));';
    expect(inventory(`# API\n\n${fence(code)}`, true)).toEqual([
      ['z.string', 'string', '6:1-8'],
      ['check', 'ZodMiniString.check', '6:12-16'],
      ['z.minLength', 'minLength', '6:18-28'],
    ]);
  });

  test('a fence that names no entry: a member is cited only when one entry alone types it', () => {
    // `.parse()` is on both `ZodString` and `ZodMiniString`: the fence does not say which.
    expect(inventory(`# API\n\n${fence('z.string().parse(x);\nz.number();')}`, true)).toEqual([
      ['z.string', 'string', '4:1-8'],
      ['z.number', 'number', '5:1-8'],
    ]);
    // `.min()` is only on `ZodString`, so the chain is the primary's from there on.
    expect(
      inventory(`# API\n\n${fence('z.string().min(5).parse(x);\nz.number();')}`, true),
    ).toEqual([
      ['z.string', 'string', '4:1-8'],
      ['min', 'ZodString.min', '4:12-14'],
      ['parse', 'ZodString.parse', '4:19-23'],
      ['z.number', 'number', '5:1-8'],
    ]);
  });

  test('a rule hit in the fence on the same export replaces the inventory claim', () => {
    const code = 'import * as z from "zod";\n\nconst Empty = z.object();';
    expect(inventory(`# API\n\n${fence(code)}`)).toEqual([]);
  });
});

describe("on an API reference section for an export, its bare builtin name is the export's", () => {
  function valibotLike(): ApiSpec {
    const fn = (name: string) => ({ id: name, name, kind: 'function' });
    return {
      meta: { name: 'valibot' },
      exports: ['string', 'number', 'object', 'array', 'pipe'].map(fn),
    };
  }

  function refs(content: string) {
    const spec = valibotLike();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'api/string/index.md',
      content,
    })
      .claims.filter((c) => c.specRef && c.kind !== 'heading')
      .map((c) => `${c.kind}:${c.specRef?.export}:${c.locator.start.line}`);
  }

  test('a page whose H1 is exactly the export: `string` is the export, `number` still is not', () => {
    expect(
      refs(
        '# string\n\nCreates a string schema.\n\n## Explanation\n\nWith `string` you validate a `number` of things.\n',
      ),
    ).toEqual(['inline:string:7', 'prose:string:7']);
  });

  test('a frontmatter title that is exactly the export', () => {
    expect(refs('---\ntitle: string\n---\n\nWith `string` you can validate.\n')).toEqual([
      'inline:string:5',
      'prose:string:5',
    ]);
    expect(refs('---\ntitle: "string()"\n---\n\nWith `string` you can validate.\n')).toEqual([
      'inline:string:5',
      'prose:string:5',
    ]);
  });

  test('a code or call-form heading scopes its own section only', () => {
    expect(
      refs(
        '# Schemas\n\n## `string`\n\nUse `string` here.\n\n### Notes\n\nStill `string`.\n\n## object()\n\nAn `object`, not a `string`.\n\n## array\n\nAn `array` of things.\n',
      ),
    ).toEqual([
      'inline:string:5',
      'inline:string:9',
      'inline:object:13',
      'prose:string:5',
      'prose:string:9',
      'prose:object:13',
    ]);
  });

  test('a builtin name that is only a member is never the export by context', () => {
    const spec = valibotLike();
    spec.exports.push({
      id: 'Store',
      name: 'Store',
      kind: 'interface',
      members: [{ name: 'set', kind: 'method' }],
    });
    const doc = buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/atoms.md',
      content: '# Atoms\n\nOverwritten using the `set` function.\n',
    });
    expect(doc.claims.filter((c) => c.specRef)).toEqual([]);
  });

  test('a title that only contains the name is not that export', () => {
    expect(refs('# string schemas\n\nWith `string` you validate.\n')).toEqual([]);
    expect(refs('# Strings\n\nA `string` in JavaScript.\n')).toEqual([]);
  });

  test('anywhere: the word after the code span says it is the API', () => {
    expect(
      refs(
        "# Guide\n\nValibot's own `string` schema, the `pipe` method, the `object` function and the `array` API.\n\nA JavaScript `number` type, a `string` value, the `object` schemas.\n",
      ),
    ).toEqual([
      'inline:string:3',
      'inline:pipe:3',
      'inline:object:3',
      'inline:array:3',
      'prose:string:3',
      'prose:pipe:3',
      'prose:object:3',
      'prose:array:3',
    ]);
  });
});

describe('prose-literal-type-mismatch: a literal of the wrong primitive type', () => {
  const F3 = '```';
  const STR = { type: 'string' };
  const NUM = { type: 'number' };
  const BOOL = { type: 'boolean' };
  const UNDEF = { type: 'undefined' };
  const param = (name: string, schema: unknown, required = true) => ({ name, required, schema });
  const fn = (name: string, ...overloads: ReturnType<typeof param>[][]) => ({
    id: name,
    name,
    kind: 'function',
    signatures: overloads.map((parameters) => ({ parameters })),
  });

  function hooksSpec(): ApiSpec {
    return {
      meta: { name: PKG },
      exports: [
        fn('useOthersOnLocation', [param('locationId', NUM)]),
        fn('useLabel', [param('label', STR)]),
        fn('useFlag', [param('enabled', BOOL)]),
        fn('useDelay', [param('ms', { anyOf: [NUM, UNDEF] }, false)]),
        fn('useEither', [param('id', { anyOf: [STR, NUM] })]),
        fn('useEvent', [param('event', { type: 'string', enum: ['open', 'close'] })]),
        fn('useGeneric', [param('value', { 'x-ts-type': 'T' })]),
        fn('useAny', [param('value', { 'x-ts-type': 'any' })]),
        fn('useUnknown', [param('value', 'unknown')]),
        fn('useBranded', [param('id', { allOf: [STR, { type: 'object', properties: {} }] })]),
        fn('useExternal', [param('id', { $ref: '#/types/Missing' })]),
        fn('useFormat', [param('id', { type: 'string', format: 'uuid' })]),
        fn('useOverloaded', [param('key', NUM)], [param('key', STR), param('ttl', NUM)]),
        fn('useStrict', [param('key', NUM)], [param('key', BOOL)]),
        fn('useRest', [param('first', NUM), { ...param('rest', NUM), rest: true }]),
        fn('useOptions', [param('options', { $ref: '#/types/Options' })]),
        fn('useOpen', [param('options', { $ref: '#/types/OpenOptions' })]),
        fn('Counter', [param('props', { $ref: '#/types/CounterProps' })]),
      ],
      types: [
        {
          id: 'Options',
          name: 'Options',
          kind: 'interface',
          schema: {
            type: 'object',
            properties: { count: NUM, label: STR, mode: { anyOf: [STR, NUM] } },
            required: ['count'],
          },
        },
        {
          id: 'OpenOptions',
          name: 'OpenOptions',
          kind: 'interface',
          schema: { type: 'object', properties: { count: NUM }, additionalProperties: true },
        },
        {
          id: 'CounterProps',
          name: 'CounterProps',
          kind: 'interface',
          schema: { type: 'object', properties: { count: NUM, label: STR, live: BOOL } },
        },
      ],
    };
  }

  function mismatches(code: string, lang = 'tsx') {
    const spec = hooksSpec();
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/hooks.md',
      content: `# Hooks\n\n${F3}${lang}\n${code}\n${F3}\n`,
    })
      .claims.filter((c) => c.rule?.type === 'prose-literal-type-mismatch')
      .map((c) => [
        c.text,
        `${c.locator.start.line}:${c.locator.start.col}-${c.locator.end.col}`,
        c.specRef?.export,
        c.rule?.issue,
      ]);
  }

  test('a string literal where the spec declares `number`: the locator is the literal', () => {
    expect(mismatches('const others = useOthersOnLocation("/dashboard");')).toEqual([
      [
        '"/dashboard"',
        '4:36-47',
        'useOthersOnLocation',
        "Argument 1 of 'useOthersOnLocation' is a string literal; the spec declares 'locationId: number'",
      ],
    ]);
    expect(mismatches('const others = useOthersOnLocation(42);')).toEqual([]);
    expect(mismatches('const others = useOthersOnLocation(id);')).toEqual([]);
  });

  test('every literal kind against every other primitive', () => {
    const issue = (code: string) => mismatches(code).map((m) => m[3]);
    expect(issue('useFlag(`on`)')).toEqual([
      "Argument 1 of 'useFlag' is a string literal; the spec declares 'enabled: boolean'",
    ]);
    expect(issue('useLabel(5)')).toEqual([
      "Argument 1 of 'useLabel' is a number literal; the spec declares 'label: string'",
    ]);
    expect(issue('useFlag(-1)')).toEqual([
      "Argument 1 of 'useFlag' is a number literal; the spec declares 'enabled: boolean'",
    ]);
    expect(issue('useLabel(true)')).toEqual([
      "Argument 1 of 'useLabel' is a boolean literal; the spec declares 'label: string'",
    ]);
    expect(issue('useOthersOnLocation(false)')).toEqual([
      "Argument 1 of 'useOthersOnLocation' is a boolean literal; the spec declares 'locationId: number'",
    ]);
    // A template with a substitution is not a literal.
    expect(issue('useFlag(`on-${id}`)')).toEqual([]);
  });

  test('`| undefined` / optional is unwrapped', () => {
    expect(mismatches('useDelay(200)')).toEqual([]);
    expect(mismatches('useDelay("200")').map((m) => m[3])).toEqual([
      "Argument 1 of 'useDelay' is a string literal; the spec declares 'ms: number'",
    ]);
  });

  test('silent: unions, literal unions, generics, any/unknown, branded, unresolved, formats', () => {
    for (const code of [
      'useEither(5)',
      'useEither(true)',
      'useEvent(5)',
      'useGeneric(5)',
      'useAny(5)',
      'useUnknown(5)',
      'useBranded(5)',
      'useExternal(5)',
      'useFormat(5)',
      'useRest(1, "two")',
      'useOthersOnLocation(...args, "x")',
      'notAnExport("x")',
    ]) {
      expect(mismatches(code)).toEqual([]);
    }
  });

  test('overloads: fires only when the literal fits none that take that many arguments', () => {
    expect(mismatches('useOverloaded("k")')).toEqual([]);
    expect(mismatches('useOverloaded(true)').map((m) => m[3])).toEqual([
      "Argument 1 of 'useOverloaded' is a boolean literal; the spec declares 'key: number'",
    ]);
    expect(mismatches('useOverloaded("k", "soon")').map((m) => m[3])).toEqual([
      "Argument 2 of 'useOverloaded' is a string literal; the spec declares 'ttl: number'",
    ]);
    expect(mismatches('useStrict("k")').map((m) => m[3])).toEqual([
      "Argument 1 of 'useStrict' is a string literal; the spec declares 'key: number'",
    ]);
  });

  test('object-literal property values against a closed parameter shape', () => {
    expect(mismatches('useOptions({ count: "5", label: "ok", mode: true })')).toEqual([
      [
        '"5"',
        '4:21-23',
        'useOptions',
        "Property 'count' of argument 1 of 'useOptions' is a string literal; the spec declares 'count: number'",
      ],
    ]);
    expect(mismatches('useOpen({ count: "5" })')).toEqual([]);
    expect(mismatches('useOptions({ count, label })')).toEqual([]);
  });

  test('JSX: a string attribute against `count: number` fires; an expression of the right type does not', () => {
    expect(mismatches('const el = <Counter count="5" label="hits" />')).toEqual([
      [
        '"5"',
        '4:27-29',
        'Counter',
        "Prop 'count' of '<Counter>' is a string literal; the spec declares 'count: number'",
      ],
    ]);
    expect(mismatches('const el = <Counter count={5} label={"hits"} live />')).toEqual([]);
    expect(mismatches('const el = <Counter label={5} />').map((m) => m[3])).toEqual([
      "Prop 'label' of '<Counter>' is a number literal; the spec declares 'label: string'",
    ]);
  });

  test('same resolution as the other call-site rules: a shadowed or foreign callee is silent', () => {
    expect(mismatches('const useLabel = (n) => n;\nuseLabel(5)')).toEqual([]);
    expect(mismatches('import { useLabel } from "other";\nuseLabel(5)')).toEqual([]);
  });
});

describe('prose-unknown-key across overloads', () => {
  const F3 = '```';
  const closed = (keys: string[]) => ({
    type: 'object',
    properties: Object.fromEntries(keys.map((k) => [k, {}])),
  });

  function hits(second: unknown, code: string) {
    const spec = {
      meta: { name: 'pkg' },
      exports: [
        {
          id: 'toJSONSchema',
          name: 'toJSONSchema',
          kind: 'function',
          signatures: [
            {
              parameters: [
                { name: 'schema', required: true, schema: { 'x-ts-type': 'T' } },
                { name: 'params', required: false, schema: closed(['target', 'io']) },
              ],
            },
            {
              parameters: [
                { name: 'registry', required: true, schema: { 'x-ts-type': 'Registry' } },
                { name: 'params', required: false, schema: second },
              ],
            },
          ],
        },
      ],
      types: [],
    } as unknown as ApiSpec;
    return buildPageDocument({
      spec,
      registry: buildExportRegistry(spec),
      file: 'docs/json.md',
      content: `# JSON\n\n${F3}ts\nimport { toJSONSchema } from 'pkg'\n${code}\n${F3}\n`,
    })
      .claims.filter((c) => c.rule?.type === 'prose-unknown-key')
      .map((c) => c.rule?.issue);
  }

  test('a key any overload declares is known', () => {
    const code = 'toJSONSchema(registry, { uri: (id) => id })';
    expect(hits(closed(['target', 'io', 'uri']), code)).toEqual([]);
  });

  test('an overload whose object shape cannot be seen silences the rule', () => {
    const code = 'toJSONSchema(registry, { uri: (id) => id })';
    expect(hits({ $ref: '#/types/Unresolved' }, code)).toEqual([]);
  });

  test('an overload that takes a primitive there does not', () => {
    const code = 'toJSONSchema(schema, { uri: (id) => id })';
    expect(hits({ type: 'string' }, code)).toEqual(["Unknown key 'uri' on 'toJSONSchema'"]);
  });
});
