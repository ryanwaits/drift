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
