import { describe, expect, test } from 'bun:test';
import type { ApiSpec } from '../src/analysis/api-spec';
import {
  collectTypeKeys,
  computeKeyCoverage,
  findTypeEntry,
  parseReplacement,
} from '../src/analysis/key-coverage/diff-keys';
import { extractDocumentedKeys } from '../src/analysis/key-coverage/extract-keys';

// ── Fixture page: distilled from posthog.com edge cases ─────────────────────

const CONFIG_PAGE = `---
title: Configuring the SDK
---

# Configuring

Intro prose mentioning \`irrelevant_token\` inline.

## Configuration options

| Option | Description |
| --- | --- |
| \`api_host\` | Host |
| [\`autocapture\`](/docs/autocapture) | Linked cell |
| \`fetch_options.cache\` | Dotted sub-key |
| <br/>\`ui_host\` \`memory\` | Key after <br/>; later tokens are values, not keys |
| \`ghost_option\` | Documented but not in any type |
| \`sub_key\` | Belongs to a sub-config type |
| \`personalApiKey\` | Deprecated but documented |

\`\`\`bash
# this heading-like comment must NOT end the section
echo "| \`not_a_key\` |"
\`\`\`

| \`after_fence\` | Still in section |

### Sub-heading stays inside the section

| \`nested_row\` | Deeper heading does not exit |

## Unrelated section

| \`outside_key\` | Table outside the options section |

## Tracing headers

Prose documenting \`tracing_headers\` with a code example:

\`\`\`ts
posthog.init({ tracing_headers: true })
\`\`\`
`;

const SPEC: ApiSpec = {
  meta: { name: 'fixture' },
  exports: [
    {
      id: 'Options',
      name: 'Options',
      kind: 'type',
      schema: {
        allOf: [
          {
            type: 'object',
            properties: {
              api_host: { type: 'string', description: 'API host' },
              autocapture: { type: 'boolean' },
              fetch_options: { type: 'object' },
              ui_host: { type: 'string' },
              alt_host: { type: 'string' },
              after_fence: { type: 'string' },
              nested_row: { type: 'string' },
              tracing_headers: { type: 'boolean', description: 'Send tracing headers' },
              undocumented_opt: { type: 'string', description: 'Not documented anywhere' },
              _internal_opt: { type: 'string' },
              secretKey: { type: 'string' },
              personalApiKey: {
                type: 'string',
                deprecated: true,
                'x-deprecated-reason': 'Use `secretKey` instead.',
              },
              legacy_opt: {
                type: 'string',
                deprecated: true,
                'x-deprecated-reason': 'Use replacement_opt instead.',
              },
              replacement_opt: { type: 'string' },
              conventional_token: { type: 'string' },
            },
          },
        ],
      },
    },
  ],
  types: [
    {
      id: 'SubConfig',
      name: 'SubConfig',
      kind: 'interface',
      schema: { type: 'object', properties: { sub_key: { type: 'string' } } },
    },
  ],
};

const corpus = extractDocumentedKeys([{ path: 'docs/config.mdx', content: CONFIG_PAGE }]);

describe('extractDocumentedKeys', () => {
  test('plain, linked, dotted-prefix, and <br/>-led keys', () => {
    for (const k of ['api_host', 'autocapture', 'fetch_options', 'ui_host']) {
      expect(corpus.documented.has(k)).toBe(true);
    }
  });

  test('only the first backtick token per row is a key — value literals are not', () => {
    expect(corpus.documented.has('memory')).toBe(false);
  });

  test('section scoping: heading-level-aware exit, sub-headings stay inside', () => {
    expect(corpus.documented.has('nested_row')).toBe(true);
    expect(corpus.documented.has('outside_key')).toBe(false);
  });

  test('fenced code neither ends the section nor contributes rows', () => {
    expect(corpus.documented.has('not_a_key')).toBe(false);
    expect(corpus.documented.has('after_fence')).toBe(true);
  });

  test('locations carry file, line, section', () => {
    const loc = corpus.documented.get('api_host')?.[0];
    expect(loc?.file).toBe('docs/config.mdx');
    expect(loc?.section).toBe('Configuration options');
    expect(loc?.line).toBeGreaterThan(0);
  });

  test('inline mentions include prose and code-block identifiers', () => {
    expect(corpus.inlineMentions.has('irrelevant_token')).toBe(true);
    expect(corpus.inlineMentions.has('tracing_headers')).toBe(true);
  });

  test('custom sectionRe scopes to exact heading', () => {
    const scoped = extractDocumentedKeys([{ path: 'p.md', content: CONFIG_PAGE }], /^Tracing/);
    expect(scoped.documented.has('api_host')).toBe(false);
  });
});

describe('computeKeyCoverage', () => {
  const result = computeKeyCoverage(SPEC, 'Options', corpus, {
    annotations: { conventional_token: 'internal-by-convention' },
  });
  if (!result) throw new Error('type not found');

  test('ghosts resolve against ALL spec types — sub-type keys are not ghosts', () => {
    expect(result.ghosts.map((g) => g.key)).toEqual(['ghost_option']);
    expect(result.documentedKeysFromOtherTypes).toEqual(['sub_key']);
  });

  test('ghost carries source locations', () => {
    expect(result.ghosts[0]?.locations[0]?.file).toBe('docs/config.mdx');
  });

  test('gap classification: user-facing / internal / deprecated / annotated', () => {
    const userFacingKeys = result.gaps.userFacing.map((g) => g.key);
    expect(userFacingKeys).toContain('undocumented_opt');
    expect(userFacingKeys).toContain('tracing_headers'); // mentioned-but-not-table = still a gap
    expect(result.gaps.internal).toContain('_internal_opt');
    expect(result.gaps.internal).toContain('conventional_token');
    expect(result.gaps.deprecated).toContain('legacy_opt');
  });

  test('mentioned flag distinguishes prose-mentioned gaps', () => {
    const tracing = result.gaps.userFacing.find((g) => g.key === 'tracing_headers');
    const silent = result.gaps.userFacing.find((g) => g.key === 'undocumented_opt');
    expect(tracing?.mentioned).toBe(true);
    expect(silent?.mentioned).toBe(false);
  });

  test('gap keeps spec description for fix drafts', () => {
    const gap = result.gaps.userFacing.find((g) => g.key === 'undocumented_opt');
    expect(gap?.description).toBe('Not documented anywhere');
  });

  test('inversion auto-derived from spec deprecation reason', () => {
    expect(result.inversions).toEqual([
      { documented: 'personalApiKey', replacement: 'secretKey', source: 'spec' },
    ]);
  });

  test('prose-documented annotation suppresses the gap but reports it', () => {
    const annotated = computeKeyCoverage(SPEC, 'Options', corpus, {
      annotations: { tracing_headers: 'prose-documented' },
    });
    expect(annotated?.gaps.userFacing.map((g) => g.key)).not.toContain('tracing_headers');
    expect(annotated?.annotated.proseDocumented).toContain('tracing_headers');
  });

  test('ignore annotation removes the key entirely', () => {
    const ignored = computeKeyCoverage(SPEC, 'Options', corpus, {
      annotations: { undocumented_opt: 'ignore' },
    });
    expect(ignored?.gaps.userFacing.map((g) => g.key)).not.toContain('undocumented_opt');
    expect(ignored?.annotated.ignored).toContain('undocumented_opt');
  });

  test('map replacements override beats spec parse', () => {
    const overridden = computeKeyCoverage(SPEC, 'Options', corpus, {
      replacements: { personalApiKey: 'api_host' },
    });
    expect(overridden?.inversions).toEqual([]); // api_host IS documented
  });

  test('unknown type returns null', () => {
    expect(computeKeyCoverage(SPEC, 'Nope', corpus)).toBeNull();
  });
});

describe('helpers', () => {
  test('parseReplacement handles backticked and bare forms', () => {
    expect(parseReplacement('Use `secretKey` instead.')).toBe('secretKey');
    expect(parseReplacement('Use evaluationContexts instead. Removed soon.')).toBe(
      'evaluationContexts',
    );
    expect(parseReplacement('Deprecated.')).toBeUndefined();
  });

  test('collectTypeKeys merges allOf members and members array', () => {
    const entry = findTypeEntry(SPEC, 'Options');
    if (!entry) throw new Error('missing');
    const keys = collectTypeKeys(entry);
    expect(keys.get('personalApiKey')?.deprecated).toBe(true);
    expect(keys.get('api_host')?.description).toBe('API host');
  });
});
