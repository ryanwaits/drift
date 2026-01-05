/**
 * Tests for GitHub pattern parsing and detection
 */
import { describe, expect, test } from 'bun:test';
import {
  parseDocsPattern,
  parseGitHubPattern,
  getCacheKey,
  isRemoteSource,
} from '../src/commands/check/parseDocsPattern';

describe('parseGitHubPattern', () => {
  test('parses basic org/repo pattern', () => {
    const result = parseGitHubPattern('github:doccov/docs');
    expect(result).toEqual({
      type: 'github',
      org: 'doccov',
      repo: 'docs',
    });
  });

  test('parses gh: alias', () => {
    const result = parseGitHubPattern('gh:myorg/myrepo');
    expect(result).toEqual({
      type: 'github',
      org: 'myorg',
      repo: 'myrepo',
    });
  });

  test('parses pattern with path', () => {
    const result = parseGitHubPattern('github:doccov/docs/content/sdk');
    expect(result).toEqual({
      type: 'github',
      org: 'doccov',
      repo: 'docs',
      path: 'content/sdk',
    });
  });

  test('parses pattern with glob path', () => {
    const result = parseGitHubPattern('github:doccov/docs/content/**/*.md');
    expect(result).toEqual({
      type: 'github',
      org: 'doccov',
      repo: 'docs',
      path: 'content/**/*.md',
    });
  });

  test('parses pattern with branch', () => {
    const result = parseGitHubPattern('github:doccov/docs#main');
    expect(result).toEqual({
      type: 'github',
      org: 'doccov',
      repo: 'docs',
      branch: 'main',
    });
  });

  test('parses pattern with path and branch', () => {
    const result = parseGitHubPattern('github:doccov/docs/content#develop');
    expect(result).toEqual({
      type: 'github',
      org: 'doccov',
      repo: 'docs',
      path: 'content',
      branch: 'develop',
    });
  });

  test('parses complex pattern with glob and branch', () => {
    const result = parseGitHubPattern('github:doccov/docs/content/sdk/**/*.md#v2');
    expect(result).toEqual({
      type: 'github',
      org: 'doccov',
      repo: 'docs',
      path: 'content/sdk/**/*.md',
      branch: 'v2',
    });
  });

  test('is case insensitive for prefix', () => {
    const result1 = parseGitHubPattern('GITHUB:org/repo');
    const result2 = parseGitHubPattern('GitHub:org/repo');
    const result3 = parseGitHubPattern('GH:org/repo');

    expect(result1.type).toBe('github');
    expect(result2.type).toBe('github');
    expect(result3.type).toBe('github');
  });

  test('throws on invalid pattern (missing repo)', () => {
    expect(() => parseGitHubPattern('github:onlyorg')).toThrow('Invalid GitHub pattern');
  });
});

describe('parseDocsPattern', () => {
  test('detects github: prefix', () => {
    const result = parseDocsPattern('github:doccov/docs');
    expect(result.type).toBe('github');
  });

  test('detects gh: prefix', () => {
    const result = parseDocsPattern('gh:doccov/docs');
    expect(result.type).toBe('github');
  });

  test('detects URL patterns', () => {
    const result = parseDocsPattern('https://docs.example.com/api');
    expect(result.type).toBe('url');
  });

  test('detects local glob patterns', () => {
    const result = parseDocsPattern('docs/**/*.md');
    expect(result.type).toBe('local');
  });
});

describe('isRemoteSource', () => {
  test('returns true for github source', () => {
    const source = parseDocsPattern('github:org/repo');
    expect(isRemoteSource(source)).toBe(true);
  });

  test('returns true for url source', () => {
    const source = parseDocsPattern('https://example.com');
    expect(isRemoteSource(source)).toBe(true);
  });

  test('returns false for local source', () => {
    const source = parseDocsPattern('docs/**/*.md');
    expect(isRemoteSource(source)).toBe(false);
  });
});

describe('getCacheKey', () => {
  test('generates key for github source', () => {
    const source = parseDocsPattern('github:doccov/docs/content#main');
    const key = getCacheKey(source);
    expect(key).toBe('github:doccov/docs/content#main');
  });

  test('generates key for github source without path/branch', () => {
    const source = parseDocsPattern('github:doccov/docs');
    const key = getCacheKey(source);
    expect(key).toBe('github:doccov/docs');
  });

  test('returns null for local source', () => {
    const source = parseDocsPattern('docs/**/*.md');
    const key = getCacheKey(source);
    expect(key).toBeNull();
  });
});
