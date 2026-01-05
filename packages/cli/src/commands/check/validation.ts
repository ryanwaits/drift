import type {
  ExampleTypeError,
  ExampleValidation,
  ExampleValidationResult,
  MarkdownDocFile,
} from '@doccov/sdk';
import { validateExamples } from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import { fetchUrlDocsBatch } from './docs-fetcher';
import { fetchGitHubDocsBatch } from './github-fetcher';
import {
  type DocsSource,
  type GitHubDocsSource,
  type UrlDocsSource,
  parseDocsPatterns,
} from './parseDocsPattern';
import type { CollectedDrift, StaleReference } from './types';
import { loadMarkdownFiles } from './utils';

export interface ExampleValidationOptions {
  validations: ExampleValidation[];
  targetDir: string;
  timeout?: number;
  installTimeout?: number;
}

export interface ExampleValidationOutput {
  result: ExampleValidationResult | undefined;
  typecheckErrors: Array<{ exportName: string; error: ExampleTypeError }>;
  runtimeDrifts: CollectedDrift[];
}

/**
 * Run example validation using unified SDK function
 */
export async function runExampleValidation(
  openpkg: OpenPkg,
  options: ExampleValidationOptions,
): Promise<ExampleValidationOutput> {
  const { validations, targetDir, timeout = 5000, installTimeout = 60000 } = options;

  const typecheckErrors: Array<{ exportName: string; error: ExampleTypeError }> = [];
  const runtimeDrifts: CollectedDrift[] = [];

  const result = await validateExamples(openpkg.exports ?? [], {
    validations,
    packagePath: targetDir,
    exportNames: (openpkg.exports ?? []).map((e) => e.name),
    timeout,
    installTimeout,
  });

  // Convert typecheck errors to the expected format
  if (result.typecheck) {
    for (const err of result.typecheck.errors) {
      typecheckErrors.push({
        exportName: err.exportName,
        error: err.error,
      });
    }
  }

  // Convert runtime drifts to the expected format
  if (result.run) {
    for (const drift of result.run.drifts) {
      runtimeDrifts.push({
        name: drift.exportName,
        type: 'example-runtime-error',
        issue: drift.issue,
        suggestion: drift.suggestion,
        category: 'example',
      });
    }
  }

  return { result, typecheckErrors, runtimeDrifts };
}

export interface MarkdownValidationOptions {
  docsPatterns: string[];
  targetDir: string;
  exportNames: string[];
  useCache?: boolean;
  fetchTimeout?: number;
  cacheTtl?: number;
}

export interface ParsedDocsSources {
  local: string[];
  remote: DocsSource[];
}

/**
 * Parse docs patterns and separate local from remote sources
 */
export function parseAndSeparateDocsSources(patterns: string[]): ParsedDocsSources {
  const sources = parseDocsPatterns(patterns);
  const local: string[] = [];
  const remote: DocsSource[] = [];

  for (const source of sources) {
    if (source.type === 'local') {
      local.push(source.pattern);
    } else {
      remote.push(source);
    }
  }

  return { local, remote };
}

/**
 * Detect stale references in markdown docs
 */
export async function validateMarkdownDocs(
  options: MarkdownValidationOptions,
): Promise<StaleReference[]> {
  const { docsPatterns, targetDir, exportNames, useCache = true, fetchTimeout, cacheTtl } = options;
  const staleRefs: StaleReference[] = [];

  if (docsPatterns.length === 0) {
    return staleRefs;
  }

  // Parse patterns to detect source types
  const { local, remote } = parseAndSeparateDocsSources(docsPatterns);

  const allDocs: MarkdownDocFile[] = [];

  // Load local markdown files
  if (local.length > 0) {
    const localDocs = await loadMarkdownFiles(local, targetDir);
    allDocs.push(...localDocs);
  }

  // Fetch remote URL docs (Phase 2)
  const urlSources = remote.filter((s): s is UrlDocsSource => s.type === 'url');
  if (urlSources.length > 0) {
    const results = await fetchUrlDocsBatch(urlSources, {
      useCache,
      timeout: fetchTimeout,
      ttl: cacheTtl,
      cwd: targetDir,
    });

    for (const result of results) {
      if (result.doc) {
        allDocs.push(result.doc);
      }
      // Errors are silently skipped - could add logging here
    }
  }

  // Fetch GitHub docs (Phase 3)
  const githubSources = remote.filter((s): s is GitHubDocsSource => s.type === 'github');
  if (githubSources.length > 0) {
    const results = await fetchGitHubDocsBatch(githubSources, {
      useCache,
      timeout: fetchTimeout,
      ttl: cacheTtl,
      cwd: targetDir,
    });

    for (const result of results) {
      allDocs.push(...result.docs);
      // Errors are silently skipped - could add logging here
    }
  }

  // GitLab sources will be handled later
  // For now, skip them silently

  if (allDocs.length === 0) {
    return staleRefs;
  }

  const exportSet = new Set(exportNames);

  // Check each code block for imports that reference non-existent exports
  for (const mdFile of allDocs) {
    for (const block of mdFile.codeBlocks) {
      const codeLines = block.code.split('\n');
      for (let i = 0; i < codeLines.length; i++) {
        const line = codeLines[i];
        // Check for imports from the package
        const importMatch = line.match(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]*['"]/);
        if (importMatch) {
          const imports = importMatch[1].split(',').map((s) => s.trim().split(/\s+/)[0]);
          for (const imp of imports) {
            if (imp && !exportSet.has(imp)) {
              staleRefs.push({
                file: mdFile.path,
                line: block.lineStart + i,
                exportName: imp,
                context: line.trim(),
              });
            }
          }
        }
      }
    }
  }

  return staleRefs;
}
