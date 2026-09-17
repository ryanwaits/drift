/**
 * Question builders for docs-map propose. CLI-only — not on @driftdev/sdk.
 */

import type { ChoiceQuestion } from './evaluate';

export const TYPE_NONE = 'none';

export const KEY_CRITERIA: Record<string, string> = {
  gap: 'Real undocumented public option. Leave as a gap — do not annotate.',
  'prose-documented':
    'The page genuinely documents this key in prose (a dedicated section, not a passing mention). Only valid when the key appears in backticks or `key:` form.',
  'internal-by-convention':
    'Internal or platform key not meant for public docs (auth tokens, conventional internals).',
  ignore:
    'Known-irrelevant or phantom extractor key. Requires a human-committed reason before commit.',
};

export function snippetAround(text: string, key: string, radius = 180): string | undefined {
  const needle = `\`${key}\``;
  let idx = text.indexOf(needle);
  let width = needle.length;
  if (idx < 0) {
    const alt = `${key}:`;
    idx = text.indexOf(alt);
    width = alt.length;
    if (idx < 0) return undefined;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + width + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function typeQuestion(
  page: string,
  candidates: Array<{ type: string; overlap: number; keys: number }>,
  current?: string,
): ChoiceQuestion {
  const criteria: Record<string, string | null> = {};
  for (const c of candidates) {
    criteria[c.type] = `overlap ${c.overlap} of ${c.keys} type keys`;
  }
  if (current && !(current in criteria)) criteria[current] = 'currently mapped in the docs map';
  criteria[TYPE_NONE] = 'None of these types is what the page documents';
  return {
    type: 'choice',
    instructions: `Which spec type does docs page "${page}" document? Pick ${TYPE_NONE} if none fit.`,
    criteria,
  };
}

export function keyQuestion(args: {
  page: string;
  type: string;
  key: string;
  description?: string;
  mentioned: boolean;
}): ChoiceQuestion {
  const desc = args.description ? ` Spec: ${args.description}` : '';
  const mention = args.mentioned ? 'mentioned in prose' : 'not mentioned on the page';
  return {
    type: 'choice',
    instructions: `Classify undocumented key "${args.key}" on page "${args.page}" (type ${args.type}; ${mention}).${desc} Prefer gap unless the page genuinely documents it in prose or it is internal-by-convention.`,
    criteria: KEY_CRITERIA,
  };
}
