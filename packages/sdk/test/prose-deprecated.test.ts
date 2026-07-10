import { describe, expect, test } from 'bun:test';
import type { ApiSpec } from '../src/analysis/api-spec';
import { buildExportRegistry } from '../src/analysis/drift/compute';
import { detectProseDrift } from '../src/analysis/drift/prose-drift';
import { parseMarkdownFile } from '../src/markdown/parser';

const PKG = '@acme/sdk';

function spec(): ApiSpec {
  return {
    meta: { name: PKG },
    exports: [
      { id: 'execute', name: 'execute', kind: 'function' },
      {
        id: 'runSnippet',
        name: 'runSnippet',
        kind: 'function',
        deprecated: true,
        tags: [{ name: 'deprecated', text: 'use execute instead' }],
      },
      {
        id: 'Session',
        name: 'Session',
        kind: 'class',
        members: [
          { name: 'run', kind: 'method' },
          {
            name: 'legacyRun',
            kind: 'method',
            deprecated: true,
            tags: [{ name: 'deprecated', text: 'use run' }],
          },
        ],
      },
      {
        id: 'OtherSession',
        name: 'OtherSession',
        kind: 'class',
        members: [{ name: 'sharedName', kind: 'method' }],
      },
      {
        id: 'LegacySession',
        name: 'LegacySession',
        kind: 'class',
        members: [{ name: 'sharedName', kind: 'method', deprecated: true }],
      },
    ],
  };
}

function drift(markdown: string) {
  const registry = buildExportRegistry(spec());
  const file = parseMarkdownFile(markdown, 'docs/guide.md');
  return detectProseDrift({ packageName: PKG, markdownFiles: [file], registry });
}

describe('prose-deprecated-reference', () => {
  test('import of deprecated export flagged with note', () => {
    const issues = drift(`# Guide

\`\`\`ts
import { runSnippet } from '${PKG}';
runSnippet('(+ 1 2)');
\`\`\`
`);
    const dep = issues.filter((i) => i.type === 'prose-deprecated-reference');
    expect(dep).toHaveLength(1);
    expect(dep[0].target).toBe('runSnippet');
    expect(dep[0].suggestion).toContain('use execute instead');
    expect(dep[0].filePath).toBe('docs/guide.md');
  });

  test('member call on deprecated member flagged', () => {
    const issues = drift(`# Guide

\`\`\`ts
import { Session } from '${PKG}';
const s = new Session();
s.legacyRun();
\`\`\`
`);
    const dep = issues.filter((i) => i.type === 'prose-deprecated-reference');
    expect(dep).toHaveLength(1);
    expect(dep[0].target).toBe('legacyRun');
  });

  test('member deprecated on one type but live on another is not flagged', () => {
    const issues = drift(`# Guide

\`\`\`ts
import { OtherSession } from '${PKG}';
const s = new OtherSession();
s.sharedName();
\`\`\`
`);
    expect(issues.filter((i) => i.type === 'prose-deprecated-reference')).toHaveLength(0);
  });

  test('suppressed when surrounding prose mentions deprecation', () => {
    const issues = drift(`# Guide

Note: \`runSnippet\` is deprecated, shown here for migration only.

\`\`\`ts
import { runSnippet } from '${PKG}';
runSnippet('(+ 1 2)');
\`\`\`
`);
    expect(issues.filter((i) => i.type === 'prose-deprecated-reference')).toHaveLength(0);
  });

  test('non-deprecated references stay clean', () => {
    const issues = drift(`# Guide

\`\`\`ts
import { execute, Session } from '${PKG}';
execute('(+ 1 2)');
new Session().run();
\`\`\`
`);
    expect(issues.filter((i) => i.type === 'prose-deprecated-reference')).toHaveLength(0);
  });

  test('one finding per name per file across blocks', () => {
    const issues = drift(`# Guide

\`\`\`ts
import { runSnippet } from '${PKG}';
\`\`\`

More prose here about unrelated topics. Padding line.
Padding line. Padding line. Padding line. Padding line. Padding line.

\`\`\`ts
import { runSnippet } from '${PKG}';
\`\`\`
`);
    expect(issues.filter((i) => i.type === 'prose-deprecated-reference')).toHaveLength(1);
  });

  test('instance typing: deprecated on derived type wins over ambiguous raw type', () => {
    // Mirrors clarinet: runSnippet deprecated on Simnet (proxy) but live on raw SDK class.
    const clarinetLike: ApiSpec = {
      meta: { name: PKG },
      exports: [
        {
          id: 'initSimnet',
          name: 'initSimnet',
          kind: 'function',
          signatures: [
            {
              returns: {
                schema: {
                  $ref: '#/types/Promise',
                  'x-ts-type-arguments': [{ $ref: '#/types/Simnet' }],
                },
              },
            },
          ],
        },
        {
          id: 'Simnet',
          name: 'Simnet',
          kind: 'type',
          members: [
            {
              name: 'runSnippet',
              kind: 'method',
              deprecated: true,
              tags: [{ name: 'deprecated', text: 'use simnet.execute(command) instead' }],
            },
            { name: 'execute', kind: 'method' },
          ],
        },
      ],
      types: [
        {
          id: 'SDK',
          name: 'SDK',
          kind: 'class',
          members: [
            { name: 'runSnippet', kind: 'method' },
            { name: 'execute', kind: 'method' },
          ],
        },
      ],
    };
    const registry = buildExportRegistry(clarinetLike);
    const file = parseMarkdownFile(
      `# Guide

\`\`\`ts
import { initSimnet } from '${PKG}';
const simnet = await initSimnet();
simnet.runSnippet('(+ 1 2)');
\`\`\`
`,
      'docs/guide.md',
    );
    const issues = detectProseDrift({ packageName: PKG, markdownFiles: [file], registry });
    const dep = issues.filter((i) => i.type === 'prose-deprecated-reference');
    expect(dep).toHaveLength(1);
    expect(dep[0].target).toBe('runSnippet');
    expect(dep[0].suggestion).toContain('simnet.execute');
  });

  test('imports from other packages are ignored', () => {
    const issues = drift(`# Guide

\`\`\`ts
import { runSnippet } from 'some-other-package';
\`\`\`
`);
    expect(issues.filter((i) => i.type === 'prose-deprecated-reference')).toHaveLength(0);
  });
});
