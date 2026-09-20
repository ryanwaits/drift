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
      '# Mutations\n\n```ts\nuseMutation()\n```\n',
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
