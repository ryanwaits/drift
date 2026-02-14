import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseMarkdownFile } from './parser';
import type { MarkdownDocFile } from './types';

export interface DiscoverOptions {
  include?: string[];
  exclude?: string[];
}

const DEFAULT_INCLUDE = ['README.md', 'docs/**/*.md', 'docs/**/*.mdx', 'content/**/*.md', 'content/**/*.mdx'];
const DEFAULT_EXCLUDE = ['node_modules/**', 'dist/**', '.git/**'];

/**
 * Discover and parse markdown files in a directory.
 */
export function discoverMarkdownFiles(cwd: string, options?: DiscoverOptions): MarkdownDocFile[] {
  const include = options?.include ?? DEFAULT_INCLUDE;
  const exclude = options?.exclude ?? DEFAULT_EXCLUDE;
  const seen = new Set<string>();
  const files: MarkdownDocFile[] = [];

  for (const pattern of include) {
    const matches = globSync(pattern, { cwd, exclude });

    for (const match of matches) {
      const relativePath = match;
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
