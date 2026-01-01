/**
 * Markdown/MDX parser for extracting code blocks
 *
 * Uses unified/remark ecosystem for AST parsing
 */

import type { Code, Root } from 'mdast';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import {
  extractFunctionCalls,
  extractImports,
  hasInstantiationAST,
  type MethodCallInfo,
} from './ast-extractor';
import type { ExportReference, MarkdownCodeBlock, MarkdownDocFile } from './types';

export type { MethodCallInfo } from './ast-extractor';
// Re-export AST-based extraction functions
export { extractFunctionCalls, extractImports, extractMethodCalls } from './ast-extractor';

/**
 * Default set of languages that can be executed.
 * Extended to cover more modern JS/TS conventions.
 */
const DEFAULT_EXECUTABLE_LANGS = new Set([
  // TypeScript
  'ts',
  'typescript',
  'tsx',
  'mts',
  'cts',
  // JavaScript
  'js',
  'javascript',
  'jsx',
  'mjs',
  'cjs',
  // Generic aliases
  'node',
  'esm',
]);

/** Options for parsing markdown files */
export interface ParseOptions {
  /** Custom set of executable language tags */
  executableLangs?: string[];
}

// Global executable langs (can be configured)
let configuredExecutableLangs: Set<string> = DEFAULT_EXECUTABLE_LANGS;

/**
 * Configure the global set of executable language tags.
 * Call this before parsing to customize which code blocks are considered executable.
 *
 * @param langs - Array of language tags to consider executable
 */
export function setExecutableLangs(langs: string[]): void {
  configuredExecutableLangs = new Set(langs.map((l) => l.toLowerCase()));
}

/**
 * Get the current set of executable language tags.
 */
export function getExecutableLangs(): string[] {
  return Array.from(configuredExecutableLangs);
}

/**
 * Reset executable languages to defaults.
 */
export function resetExecutableLangs(): void {
  configuredExecutableLangs = DEFAULT_EXECUTABLE_LANGS;
}

/**
 * Check if a language tag represents executable code
 */
export function isExecutableLang(
  lang: string | null | undefined,
  customLangs?: Set<string>,
): boolean {
  if (!lang) return false;
  const langsToCheck = customLangs ?? configuredExecutableLangs;
  return langsToCheck.has(lang.toLowerCase());
}

/**
 * Parse a markdown file and extract code blocks
 */
export function parseMarkdownFile(
  content: string,
  filePath: string,
  options?: ParseOptions,
): MarkdownDocFile {
  const processor = unified().use(remarkParse).use(remarkMdx);
  const tree = processor.parse(content) as Root;
  const codeBlocks: MarkdownCodeBlock[] = [];

  // Use custom langs if provided, otherwise use global config
  const executableLangs = options?.executableLangs
    ? new Set(options.executableLangs.map((l) => l.toLowerCase()))
    : undefined;

  visit(tree, 'code', (node: Code) => {
    if (isExecutableLang(node.lang, executableLangs)) {
      codeBlocks.push({
        lang: node.lang ?? 'ts',
        code: node.value,
        meta: node.meta ?? undefined,
        lineStart: node.position?.start.line ?? 0,
        lineEnd: node.position?.end.line ?? 0,
      });
    }
  });

  return { path: filePath, codeBlocks };
}

/**
 * Parse multiple markdown files
 */
export function parseMarkdownFiles(
  files: Array<{ path: string; content: string }>,
  options?: ParseOptions,
): MarkdownDocFile[] {
  return files.map((f) => parseMarkdownFile(f.content, f.path, options));
}

/**
 * Check if code contains a class instantiation (new ClassName())
 */
export function hasInstantiation(code: string, className: string): boolean {
  return hasInstantiationAST(code, className);
}

/**
 * Find all references to given export names in markdown files
 */
export function findExportReferences(
  files: MarkdownDocFile[],
  exportNames: string[],
): ExportReference[] {
  const references: ExportReference[] = [];
  const exportSet = new Set(exportNames);

  for (const file of files) {
    // Search in code blocks
    for (let blockIndex = 0; blockIndex < file.codeBlocks.length; blockIndex++) {
      const block = file.codeBlocks[blockIndex];

      // Check imports
      const imports = extractImports(block.code);
      for (const imp of imports) {
        if (exportSet.has(imp.name)) {
          references.push({
            exportName: imp.name,
            file: file.path,
            line: block.lineStart,
            context: getContextFromCode(block.code, imp.name),
            inCodeBlock: true,
            blockIndex,
          });
        }
      }

      // Check function calls
      const calls = extractFunctionCalls(block.code);
      for (const call of calls) {
        if (exportSet.has(call)) {
          // Avoid duplicates if already found via import
          const alreadyFound = references.some(
            (r) => r.exportName === call && r.file === file.path && r.blockIndex === blockIndex,
          );
          if (!alreadyFound) {
            references.push({
              exportName: call,
              file: file.path,
              line: block.lineStart,
              context: getContextFromCode(block.code, call),
              inCodeBlock: true,
              blockIndex,
            });
          }
        }
      }
    }
  }

  return references;
}

/**
 * Get context around a reference in code
 */
function getContextFromCode(code: string, name: string): string {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(name)) {
      // Return the line and one line before/after
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length, i + 2);
      return lines.slice(start, end).join('\n');
    }
  }
  return code.slice(0, 100);
}

/**
 * Check if a code block references any of the given export names
 */
export function blockReferencesExport(block: MarkdownCodeBlock, exportName: string): boolean {
  const imports = extractImports(block.code);
  if (imports.some((i) => i.name === exportName)) {
    return true;
  }
  const calls = extractFunctionCalls(block.code);
  return calls.includes(exportName);
}
