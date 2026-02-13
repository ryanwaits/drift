/**
 * GitHub utilities for URL parsing.
 */

/**
 * Parsed components of a GitHub URL.
 */
export interface ParsedGitHubUrl {
  /** Repository owner (user or org) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Git ref (branch or tag) */
  ref: string;
}

/**
 * Parse a GitHub URL or shorthand into components.
 *
 * Supported formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/tree/branch
 * - https://github.com/owner/repo/tree/v1.0.0
 * - github.com/owner/repo
 * - owner/repo (shorthand)
 * - git@github.com:owner/repo.git
 *
 * @param input - GitHub URL or shorthand
 * @param [defaultRef] - Default ref if not specified in URL (default: 'main')
 * @returns Parsed components
 * @throws Error if the URL format is invalid
 *
 * @example
 * ```typescript
 * import { parseGitHubUrl } from '@driftdev/sdk';
 *
 * const parsed = parseGitHubUrl('https://github.com/vercel/next.js/tree/canary');
 * // { owner: 'vercel', repo: 'next.js', ref: 'canary' }
 *
 * const shorthand = parseGitHubUrl('vercel/next.js');
 * // { owner: 'vercel', repo: 'next.js', ref: 'main' }
 * ```
 */
export function parseGitHubUrl(input: string, defaultRef = 'main'): ParsedGitHubUrl {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('GitHub URL cannot be empty');
  }

  // Remove protocol if present
  let normalized = trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/\.git$/, '');

  // Remove github.com prefix if present
  normalized = normalized.replace(/^github\.com\//, '');

  // Now we should have: owner/repo or owner/repo/tree/ref
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length < 2) {
    throw new Error(
      `Invalid GitHub URL format: "${input}". Expected owner/repo or https://github.com/owner/repo`,
    );
  }

  const owner = parts[0];
  const repo = parts[1];

  // Check for /tree/ref or /blob/ref pattern
  let ref = defaultRef;
  if (parts.length >= 4 && (parts[2] === 'tree' || parts[2] === 'blob')) {
    ref = parts.slice(3).join('/'); // Handle refs with slashes like feature/branch
  }

  if (!owner || !repo) {
    throw new Error(`Could not parse owner/repo from: "${input}"`);
  }

  return { owner, repo, ref };
}
