import { globSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parseMarkdownFile } from './parser';
import type { MarkdownDocFile } from './types';

export interface DiscoverOptions {
  include?: string[];
  exclude?: string[];
}

const DEFAULT_INCLUDE = ['README.md', 'docs/**/*.md', 'docs/**/*.mdx'];
const DEFAULT_EXCLUDE = ['node_modules/**', 'dist/**', '.git/**'];

/**
 * Discover and parse markdown files in a directory.
 */
export function discoverMarkdownFiles(
  cwd: string,
  options?: DiscoverOptions,
): MarkdownDocFile[] {
  const include = options?.include ?? DEFAULT_INCLUDE;
  const exclude = options?.exclude ?? DEFAULT_EXCLUDE;
  const seen = new Set<string>();
  const files: MarkdownDocFile[] = [];

  for (const pattern of include) {
    const matches = globSync(pattern, { cwd, exclude });

    for (const match of matches) {
      const relativePath = typeof match === 'string' ? match : relative(cwd, match.toString());
      if (seen.has(relativePath)) continue;
      seen.add(relativePath);

      const absPath = resolve(cwd, relativePath);
      let content: string;
      try {
        content = readFileSync(absPath, 'utf-8');
      } catch {
        continue;
      }

      files.push(parseMarkdownFile(content, relativePath));
    }
  }

  return files;
}
