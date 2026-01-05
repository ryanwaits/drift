/**
 * Spec diff utilities - direct comparison without GitHub access.
 * GitHub-based diff operations require sandbox package (Bun runtime).
 */

import {
  diffSpecWithDocs,
  type MarkdownDocFile,
  parseMarkdownFiles,
  type SpecDiffWithDocs,
} from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';

/**
 * Direct diff from uploaded specs (no GitHub access needed)
 */
export function diffSpecs(
  baseSpec: OpenPkg,
  headSpec: OpenPkg,
  markdownFiles?: Array<{ path: string; content: string }>,
): SpecDiffWithDocs {
  const parsedMarkdown = markdownFiles ? parseMarkdownFiles(markdownFiles) : undefined;

  return diffSpecWithDocs(baseSpec, headSpec, {
    markdownFiles: parsedMarkdown as MarkdownDocFile[] | undefined,
  });
}

/**
 * Format diff for API response
 */
export function formatDiffResponse(
  diff: SpecDiffWithDocs,
  metadata?: {
    base?: { ref: string; sha: string };
    head?: { ref: string; sha: string };
    generatedAt?: string;
    cached?: boolean;
  },
) {
  return {
    breaking: diff.breaking,
    nonBreaking: diff.nonBreaking,
    docsOnly: diff.docsOnly,
    coverageDelta: diff.coverageDelta,
    oldCoverage: diff.oldCoverage,
    newCoverage: diff.newCoverage,
    driftIntroduced: diff.driftIntroduced,
    driftResolved: diff.driftResolved,
    newUndocumented: diff.newUndocumented,
    improvedExports: diff.improvedExports,
    regressedExports: diff.regressedExports,
    memberChanges: diff.memberChanges,
    categorizedBreaking: diff.categorizedBreaking,
    docsImpact: diff.docsImpact,
    ...(metadata?.base && { base: metadata.base }),
    ...(metadata?.head && { head: metadata.head }),
    generatedAt: metadata?.generatedAt ?? new Date().toISOString(),
    cached: metadata?.cached ?? false,
  };
}
