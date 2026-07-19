import { describe, expect, test } from 'bun:test';
import type { ApiSpec } from '../src/analysis/api-spec';
import { buildExportRegistry } from '../src/analysis/drift/compute';
import { detectProseDrift } from '../src/analysis/drift/prose-drift';
import { parseMarkdownFile } from '../src/markdown/parser';

const PKG = 'posthog-node';

function spec(): ApiSpec {
  return {
    meta: { name: PKG },
    exports: [
      {
        id: 'PostHog',
        name: 'PostHog',
        kind: 'class',
        members: [
          { name: 'capture', kind: 'method' },
          { name: 'shutdown', kind: 'method' },
        ],
      },
    ],
  };
}

function drift(markdown: string) {
  const registry = buildExportRegistry(spec());
  const file = parseMarkdownFile(markdown, 'docs/guide.md');
  return detectProseDrift({ packageName: PKG, markdownFiles: [file], registry });
}

const unresolved = (issues: ReturnType<typeof drift>) =>
  issues.filter((i) => i.type === 'prose-unresolved-member').map((i) => i.target);

describe('receiver traceability (Express false-positive class)', () => {
  test('methods on external-derived receivers are not flagged', () => {
    const issues = drift(`# Guide

\`\`\`ts
import express from 'express'
import { PostHog } from 'posthog-node'

const app = express()
const posthog = new PostHog('phc_key')

app.post('/webhook', () => {})
app.listen(3000)
\`\`\`
`);
    expect(unresolved(issues)).toEqual([]);
  });

  test('methods on untyped callback params are not flagged', () => {
    const issues = drift(`# Guide

\`\`\`ts
import express from 'express'
const app = express()
app.post('/webhook', (req, res) => {
  res.sendStatus(200)
})
\`\`\`
`);
    expect(unresolved(issues)).toEqual([]);
  });

  test('external-derived context persists across blocks', () => {
    const issues = drift(`# Guide

\`\`\`ts
import express from 'express'
const app = express()
\`\`\`

Later:

\`\`\`ts
app.use(() => {})
\`\`\`
`);
    expect(unresolved(issues)).toEqual([]);
  });

  test('params annotated with a package type ARE still validated', () => {
    const issues = drift(`# Guide

\`\`\`ts
import { PostHog } from 'posthog-node'
export function track(client: PostHog) {
  client.captureX({})
}
\`\`\`
`);
    expect(unresolved(issues)).toEqual(['client.captureX']);
  });

  test('undeclared receivers keep catching real drift', () => {
    const issues = drift(`# Guide

\`\`\`ts
posthog.captureEventX({ event: 'x' })
\`\`\`
`);
    expect(unresolved(issues)).toEqual(['posthog.captureEventX']);
  });
});
