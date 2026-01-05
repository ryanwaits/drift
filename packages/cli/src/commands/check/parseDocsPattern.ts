/**
 * Parse docs patterns to detect source type: local, URL, GitHub, GitLab
 */

export type LocalDocsSource = {
  type: 'local';
  pattern: string;
};

export type UrlDocsSource = {
  type: 'url';
  url: string;
};

export type GitHubDocsSource = {
  type: 'github';
  org: string;
  repo: string;
  path?: string;
  branch?: string;
};

export type GitLabDocsSource = {
  type: 'gitlab';
  org: string;
  repo: string;
  path?: string;
  branch?: string;
};

export type DocsSource = LocalDocsSource | UrlDocsSource | GitHubDocsSource | GitLabDocsSource;

/**
 * Parse a single docs pattern and return typed source info
 */
export function parseDocsPattern(pattern: string): DocsSource {
  // URL: https:// or http://
  if (/^https?:\/\//i.test(pattern)) {
    return { type: 'url', url: pattern };
  }

  // GitHub: github:org/repo or gh:org/repo
  if (/^(github|gh):/i.test(pattern)) {
    return parseGitHubPattern(pattern);
  }

  // GitLab: gitlab:org/repo or gl:org/repo
  if (/^(gitlab|gl):/i.test(pattern)) {
    return parseGitLabPattern(pattern);
  }

  // Default: local file glob
  return { type: 'local', pattern };
}

/**
 * Parse GitHub pattern: github:org/repo[/path][#branch]
 *
 * Examples:
 *   github:doccov/docs
 *   github:doccov/docs/content/sdk/**\/*.md
 *   github:doccov/docs#main
 *   github:doccov/docs/content#develop
 *   gh:org/repo
 */
export function parseGitHubPattern(pattern: string): GitHubDocsSource {
  // Remove prefix
  const rest = pattern.replace(/^(github|gh):/i, '');

  // Split branch if present
  const [pathPart, branch] = rest.split('#');

  // Split by / to get org, repo, and optional path
  const parts = pathPart.split('/');

  if (parts.length < 2) {
    throw new Error(
      `Invalid GitHub pattern: ${pattern}. Expected format: github:org/repo[/path][#branch]`,
    );
  }

  const org = parts[0];
  const repo = parts[1];
  const path = parts.length > 2 ? parts.slice(2).join('/') : undefined;

  return {
    type: 'github',
    org,
    repo,
    ...(path && { path }),
    ...(branch && { branch }),
  };
}

/**
 * Parse GitLab pattern: gitlab:org/repo[/path][#branch]
 *
 * Examples:
 *   gitlab:doccov/docs
 *   gitlab:doccov/docs/content/sdk/**\/*.md
 *   gl:org/repo#main
 */
export function parseGitLabPattern(pattern: string): GitLabDocsSource {
  // Remove prefix
  const rest = pattern.replace(/^(gitlab|gl):/i, '');

  // Split branch if present
  const [pathPart, branch] = rest.split('#');

  // Split by / to get org, repo, and optional path
  const parts = pathPart.split('/');

  if (parts.length < 2) {
    throw new Error(
      `Invalid GitLab pattern: ${pattern}. Expected format: gitlab:org/repo[/path][#branch]`,
    );
  }

  const org = parts[0];
  const repo = parts[1];
  const path = parts.length > 2 ? parts.slice(2).join('/') : undefined;

  return {
    type: 'gitlab',
    org,
    repo,
    ...(path && { path }),
    ...(branch && { branch }),
  };
}

/**
 * Parse multiple patterns and return typed sources
 */
export function parseDocsPatterns(patterns: string[]): DocsSource[] {
  return patterns.map(parseDocsPattern);
}

/**
 * Check if a source is a remote source (requires fetching)
 */
export function isRemoteSource(
  source: DocsSource,
): source is UrlDocsSource | GitHubDocsSource | GitLabDocsSource {
  return source.type !== 'local';
}

/**
 * Get cache key for a remote source
 */
export function getCacheKey(source: DocsSource): string | null {
  switch (source.type) {
    case 'local':
      return null;
    case 'url':
      // Use URL as cache key (normalized)
      return `url:${source.url}`;
    case 'github':
      return `github:${source.org}/${source.repo}${source.path ? `/${source.path}` : ''}${source.branch ? `#${source.branch}` : ''}`;
    case 'gitlab':
      return `gitlab:${source.org}/${source.repo}${source.path ? `/${source.path}` : ''}${source.branch ? `#${source.branch}` : ''}`;
  }
}
