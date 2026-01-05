/**
 * Fetch and parse documentation from GitHub repositories via API
 * No cloning required - uses GitHub REST API
 */

import type { MarkdownDocFile } from '@doccov/sdk';
import { minimatch } from 'minimatch';
import { getFromCache, writeToCache } from './docs-cache';
import type { GitHubDocsSource } from './parseDocsPattern';

export interface GitHubFetchOptions {
  timeout?: number;
  ttl?: number;
  useCache?: boolean;
  cwd?: string;
}

export interface GitHubFetchResult {
  source: GitHubDocsSource;
  docs: MarkdownDocFile[];
  error?: string;
  cached?: boolean;
}

interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  tree: GitHubTreeItem[];
  truncated: boolean;
}

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get GitHub token from environment
 */
function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
}

/**
 * Build headers for GitHub API requests
 */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'doccov-cli',
  };

  const token = getGitHubToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Fetch file tree from GitHub repo
 */
async function fetchFileTree(
  owner: string,
  repo: string,
  ref: string,
  timeout: number,
): Promise<GitHubTreeResponse> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: buildHeaders(),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(`GitHub API auth error (${response.status}). Set GITHUB_TOKEN for private repos or higher rate limits.`);
      }
      if (response.status === 404) {
        throw new Error(`GitHub repo not found: ${owner}/${repo}@${ref}`);
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<GitHubTreeResponse>;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`GitHub API timeout after ${timeout}ms`);
    }
    throw err;
  }
}

/**
 * Fetch raw file content from GitHub
 */
async function fetchRawContent(
  owner: string,
  repo: string,
  ref: string,
  path: string,
  timeout: number,
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'doccov-cli',
        // Raw content doesn't need auth header but may help with rate limits
        ...(getGitHubToken() ? { Authorization: `Bearer ${getGitHubToken()}` } : {}),
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }

    return response.text();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Timeout fetching ${path}`);
    }
    throw err;
  }
}

/**
 * Match files against glob pattern
 */
function matchGlob(files: string[], pattern: string): string[] {
  // Default pattern if none provided
  const glob = pattern || '**/*.md';

  return files.filter((file) => minimatch(file, glob, { matchBase: true }));
}

/**
 * Parse markdown content into MarkdownDocFile
 */
function parseMarkdownContent(content: string, sourcePath: string): MarkdownDocFile {
  const codeBlocks: MarkdownDocFile['codeBlocks'] = [];
  const lines = content.split('\n');

  let inBlock = false;
  let blockLang = '';
  let blockCode: string[] = [];
  let blockStart = 0;

  const executableLangs = new Set(['ts', 'typescript', 'js', 'javascript', 'tsx', 'jsx', 'mts', 'mjs']);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inBlock && line.startsWith('```')) {
      inBlock = true;
      blockLang = line.slice(3).trim().split(/\s/)[0] || '';
      blockCode = [];
      blockStart = i + 1;
    } else if (inBlock && line.startsWith('```')) {
      const normalizedLang = normalizeLang(blockLang);
      if (executableLangs.has(normalizedLang.toLowerCase())) {
        codeBlocks.push({
          lang: normalizedLang || 'ts',
          code: blockCode.join('\n'),
          lineStart: blockStart,
          lineEnd: i,
        });
      }
      inBlock = false;
      blockLang = '';
      blockCode = [];
    } else if (inBlock) {
      blockCode.push(line);
    }
  }

  return { path: sourcePath, codeBlocks };
}

/**
 * Normalize language aliases
 */
function normalizeLang(lang: string): string {
  const aliases: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    tsx: 'tsx',
    jsx: 'jsx',
  };
  return aliases[lang.toLowerCase()] ?? lang;
}

/**
 * Generate cache key for GitHub source
 */
function getCacheKey(source: GitHubDocsSource): string {
  return `${source.org}/${source.repo}/${source.path ?? '**/*.md'}#${source.branch ?? 'HEAD'}`;
}

/**
 * Fetch docs from a GitHub repository
 */
export async function fetchGitHubDocs(
  source: GitHubDocsSource,
  options: GitHubFetchOptions = {},
): Promise<GitHubFetchResult> {
  const {
    timeout = DEFAULT_TIMEOUT,
    ttl = DEFAULT_TTL,
    useCache = true,
    cwd = process.cwd(),
  } = options;

  const cacheKey = getCacheKey(source);

  // Check cache first
  if (useCache) {
    const cached = getFromCache(cwd, 'github', cacheKey, ttl);
    if (cached) {
      try {
        const docs = JSON.parse(cached.content) as MarkdownDocFile[];
        return { source, docs, cached: true };
      } catch {
        // Invalid cache, continue to fetch
      }
    }
  }

  try {
    const ref = source.branch ?? 'HEAD';

    // Fetch file tree
    const tree = await fetchFileTree(source.org, source.repo, ref, timeout);

    // Get all blob paths
    const allPaths = tree.tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path);

    // Filter markdown files by glob pattern
    const mdPaths = matchGlob(allPaths, source.path ?? '**/*.md')
      .filter((p) => p.endsWith('.md') || p.endsWith('.mdx'));

    if (mdPaths.length === 0) {
      return { source, docs: [] };
    }

    // Fetch content for each file (parallel with concurrency limit)
    const docs: MarkdownDocFile[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < mdPaths.length; i += BATCH_SIZE) {
      const batch = mdPaths.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (filePath) => {
          try {
            const content = await fetchRawContent(source.org, source.repo, ref, filePath, timeout);
            const sourcePath = `github:${source.org}/${source.repo}/${filePath}`;
            return parseMarkdownContent(content, sourcePath);
          } catch {
            // Skip files that fail to fetch
            return null;
          }
        }),
      );

      for (const doc of results) {
        if (doc && doc.codeBlocks.length > 0) {
          docs.push(doc);
        }
      }
    }

    // Cache results
    if (useCache) {
      writeToCache(cwd, 'github', cacheKey, JSON.stringify(docs));
    }

    return { source, docs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { source, docs: [], error: message };
  }
}

/**
 * Fetch docs from multiple GitHub sources
 */
export async function fetchGitHubDocsBatch(
  sources: GitHubDocsSource[],
  options: GitHubFetchOptions = {},
): Promise<GitHubFetchResult[]> {
  // Process sequentially to avoid rate limiting
  const results: GitHubFetchResult[] = [];
  for (const source of sources) {
    results.push(await fetchGitHubDocs(source, options));
  }
  return results;
}
