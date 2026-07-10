import { readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { discoverMarkdownFiles, type MarkdownDocFile } from '@driftdev/sdk';
import { formatWarning } from './output';

/**
 * Resolve the markdown corpus for prose-drift analysis.
 *
 * With `--docs` patterns, those become the corpus (an external docs site
 * pulled down locally, a sibling repo, etc.) — a bare directory expands to
 * all .md/.mdx files under it. Without them, falls back to the repo-local
 * defaults from config.docs.
 */
export function resolveDocsCorpus(
  cwd: string,
  docsPatterns?: string[],
  configDocs?: { include?: string[]; exclude?: string[] },
): MarkdownDocFile[] {
  if (!docsPatterns || docsPatterns.length === 0) {
    return discoverMarkdownFiles(cwd, configDocs);
  }

  const include: string[] = [];
  for (const pattern of docsPatterns) {
    if (isDirectory(path.resolve(cwd, pattern))) {
      include.push(path.join(pattern, '**/*.md'), path.join(pattern, '**/*.mdx'));
    } else {
      include.push(pattern);
    }
  }

  const files = discoverMarkdownFiles(cwd, { include });
  if (files.length === 0) {
    formatWarning(`--docs matched no markdown files: ${docsPatterns.join(', ')}`);
  }
  return files;
}

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Read the package name from cwd's package.json, if present. */
export function readPackageName(cwd = process.cwd()): string | undefined {
  try {
    const pkgJson = JSON.parse(readFileSync(path.resolve(cwd, 'package.json'), 'utf-8'));
    return typeof pkgJson.name === 'string' ? pkgJson.name : undefined;
  } catch {
    return undefined;
  }
}
