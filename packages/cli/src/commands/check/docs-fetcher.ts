/**
 * Fetch and parse external documentation from URLs
 */

import type { MarkdownDocFile } from '@doccov/sdk';
import * as cheerio from 'cheerio';
import { getFromCache, writeToCache } from './docs-cache';
import type { UrlDocsSource } from './parseDocsPattern';

export interface FetchOptions {
  timeout?: number;
  ttl?: number;
  useCache?: boolean;
  cwd?: string;
}

export interface FetchResult {
  source: UrlDocsSource;
  doc: MarkdownDocFile | null;
  error?: string;
  cached?: boolean;
}

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch docs from a single URL
 */
export async function fetchUrlDocs(
  source: UrlDocsSource,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const { timeout = DEFAULT_TIMEOUT, ttl = DEFAULT_TTL, useCache = true, cwd = process.cwd() } = options;

  // Check cache first
  if (useCache) {
    const cached = getFromCache(cwd, 'urls', source.url, ttl);
    if (cached) {
      const doc = parseContentToDoc(cached.content, source.url);
      return { source, doc, cached: true };
    }
  }

  // Fetch from URL
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'doccov-cli',
        Accept: 'text/html, text/markdown, text/plain, */*',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        source,
        doc: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const content = await response.text();
    const contentType = response.headers.get('content-type') ?? '';

    // Cache the raw content
    if (useCache) {
      writeToCache(cwd, 'urls', source.url, content);
    }

    const doc = parseContentToDoc(content, source.url, contentType);
    return { source, doc };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort')) {
      return { source, doc: null, error: `Timeout after ${timeout}ms` };
    }
    return { source, doc: null, error: message };
  }
}

/**
 * Fetch docs from multiple URLs
 */
export async function fetchUrlDocsBatch(
  sources: UrlDocsSource[],
  options: FetchOptions = {},
): Promise<FetchResult[]> {
  return Promise.all(sources.map((s) => fetchUrlDocs(s, options)));
}

/**
 * Parse fetched content into MarkdownDocFile
 */
function parseContentToDoc(
  content: string,
  url: string,
  contentType?: string,
): MarkdownDocFile | null {
  const isMarkdown = contentType?.includes('markdown') || url.endsWith('.md') || url.endsWith('.mdx');

  if (isMarkdown) {
    return parseMarkdownContent(content, url);
  }

  // Default: parse as HTML
  return parseHtmlContent(content, url);
}

/**
 * Parse raw markdown content
 */
function parseMarkdownContent(content: string, url: string): MarkdownDocFile {
  const codeBlocks = extractMarkdownCodeBlocks(content);
  return { path: url, codeBlocks };
}

/**
 * Parse HTML content and extract code blocks
 */
function parseHtmlContent(content: string, url: string): MarkdownDocFile {
  const $ = cheerio.load(content);
  const codeBlocks: MarkdownDocFile['codeBlocks'] = [];

  // Common doc site patterns for code blocks
  const selectors = [
    // Standard pre > code
    'pre code',
    'pre.highlight code',
    // Docusaurus
    'pre.prism-code',
    '.theme-code-block pre',
    // Nextra
    'pre.nextra-code',
    // MDX/rehype
    '[data-language] code',
    // Shiki
    'pre.shiki code',
    // Generic code containers
    '.code-block pre',
    '.codeblock pre',
  ];

  const seen = new Set<string>();

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const code = $el.text().trim();

      // Skip empty or already seen
      if (!code || seen.has(code)) return;
      seen.add(code);

      // Try to detect language from class names
      const lang = detectLanguage($el, $);

      // Only include JS/TS code blocks
      if (!isExecutableLang(lang)) return;

      codeBlocks.push({
        lang: lang || 'ts',
        code,
        lineStart: 0,
        lineEnd: 0,
      });
    });
  }

  return { path: url, codeBlocks };
}

/**
 * Detect language from element class names
 */
function detectLanguage($el: ReturnType<cheerio.CheerioAPI>, $: cheerio.CheerioAPI): string | null {
  // Check the element and its parent
  const classes = [
    $el.attr('class') ?? '',
    $el.parent().attr('class') ?? '',
    $el.attr('data-language') ?? '',
    $el.parent().attr('data-language') ?? '',
  ].join(' ');

  // Common patterns: language-ts, lang-typescript, prism-javascript, etc.
  const langMatch = classes.match(/(?:language|lang|prism)-(\w+)/i);
  if (langMatch) {
    return normalizeLanguage(langMatch[1]);
  }

  // Check data-lang attribute
  const dataLang = $el.attr('data-lang') || $el.parent().attr('data-lang');
  if (dataLang) {
    return normalizeLanguage(dataLang);
  }

  return null;
}

/**
 * Normalize language aliases
 */
function normalizeLanguage(lang: string): string {
  const lower = lang.toLowerCase();
  const aliases: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    tsx: 'tsx',
    jsx: 'jsx',
    node: 'js',
    esm: 'js',
  };
  return aliases[lower] ?? lower;
}

/**
 * Check if language is executable JS/TS
 */
function isExecutableLang(lang: string | null): boolean {
  if (!lang) return false;
  const executableLangs = new Set(['ts', 'typescript', 'js', 'javascript', 'tsx', 'jsx', 'mts', 'mjs']);
  return executableLangs.has(lang.toLowerCase());
}

/**
 * Extract code blocks from raw markdown text
 */
function extractMarkdownCodeBlocks(content: string): MarkdownDocFile['codeBlocks'] {
  const codeBlocks: MarkdownDocFile['codeBlocks'] = [];
  const lines = content.split('\n');

  let inBlock = false;
  let blockLang = '';
  let blockCode: string[] = [];
  let blockStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inBlock && line.startsWith('```')) {
      inBlock = true;
      blockLang = line.slice(3).trim().split(/\s/)[0] || '';
      blockCode = [];
      blockStart = i + 1;
    } else if (inBlock && line.startsWith('```')) {
      // End of block
      if (isExecutableLang(blockLang)) {
        codeBlocks.push({
          lang: normalizeLanguage(blockLang) || 'ts',
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

  return codeBlocks;
}
