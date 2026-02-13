/**
 * Docs impact analyzer
 *
 * Analyzes markdown files against spec changes to find impacted documentation
 */

import type { SpecDiff } from '@openpkg-ts/spec';
import type { MemberChange } from './member-diff';
import { extractMethodCalls, findExportReferences, hasInstantiation } from './parser';
import type {
  DocsChangeType,
  DocsImpact,
  DocsImpactReference,
  DocsImpactResult,
  ExportReference,
  MarkdownDocFile,
} from './types';

/**
 * Map spec diff categories to change types
 */
function getChangeType(
  exportName: string,
  diff: SpecDiff,
  newExportNames: string[],
): DocsChangeType | null {
  if (diff.breaking.includes(exportName)) {
    // Check if removed (not in new spec) vs signature changed (still exists)
    if (!newExportNames.includes(exportName)) {
      return 'removed';
    }
    return 'signature-changed';
  }
  return null;
}

/**
 * Map member change type to docs change type
 */
function mapMemberChangeType(memberChangeType: MemberChange['changeType']): DocsChangeType {
  switch (memberChangeType) {
    case 'removed':
      return 'method-removed';
    case 'signature-changed':
      return 'method-changed';
    default:
      return 'signature-changed';
  }
}

/**
 * Analyze docs impact from a spec diff
 *
 * @param diff - The spec diff result
 * @param markdownFiles - Parsed markdown files
 * @param [newExportNames] - All export names in the new spec (for missing docs detection)
 * @param [memberChanges] - Optional member-level changes for granular detection
 */
export function analyzeDocsImpact(
  diff: SpecDiff,
  markdownFiles: MarkdownDocFile[],
  newExportNames: string[] = [],
  memberChanges?: MemberChange[],
): DocsImpactResult {
  // Collect all changed export names
  const changedExports = [
    ...diff.breaking,
    // Note: nonBreaking are new exports, not changes to existing
  ];

  // Build a map of member changes by method name for quick lookup
  const memberChangesByMethod = new Map<string, MemberChange>();
  if (memberChanges) {
    for (const mc of memberChanges) {
      memberChangesByMethod.set(mc.memberName, mc);
    }
  }

  // Get class names that have member changes
  const classesWithMemberChanges = new Set(memberChanges?.map((mc) => mc.className) ?? []);

  // Group references by file
  const impactByFile = new Map<string, DocsImpact>();

  // Helper to add a reference
  const addReference = (file: string, ref: DocsImpactReference) => {
    let impact = impactByFile.get(file);
    if (!impact) {
      impact = { file, references: [] };
      impactByFile.set(file, impact);
    }
    impact.references.push(ref);
  };

  // Process each markdown file
  for (const mdFile of markdownFiles) {
    for (const block of mdFile.codeBlocks) {
      // Track what we've already reported to avoid duplicates
      const reportedRefs = new Set<string>();

      // 1. Check for method calls and match against member changes
      if (memberChanges && memberChanges.length > 0) {
        const methodCalls = extractMethodCalls(block.code);

        for (const call of methodCalls) {
          const memberChange = memberChangesByMethod.get(call.methodName);
          if (memberChange) {
            const refKey = `${mdFile.path}:${block.lineStart + call.line}:${call.methodName}`;
            if (!reportedRefs.has(refKey)) {
              reportedRefs.add(refKey);
              addReference(mdFile.path, {
                exportName: memberChange.className,
                memberName: call.methodName,
                memberChangeType: memberChange.changeType,
                changeType: mapMemberChangeType(memberChange.changeType),
                replacementSuggestion: memberChange.suggestion,
                line: block.lineStart + call.line,
                context: call.context,
                isInstantiation: false,
              });
            }
          }
        }

        // 2. Check for class instantiations (new ClassName())
        // These are lower priority - only report if no method calls were found
        for (const className of classesWithMemberChanges) {
          if (hasInstantiation(block.code, className)) {
            const refKey = `${mdFile.path}:${block.lineStart}:new ${className}`;
            if (!reportedRefs.has(refKey)) {
              // Only add instantiation refs if there are no method-level refs for this class
              const hasMethodRefs = Array.from(reportedRefs).some(
                (key) =>
                  key.startsWith(`${mdFile.path}:`) &&
                  memberChanges.some(
                    (mc) => mc.className === className && key.includes(mc.memberName),
                  ),
              );

              if (!hasMethodRefs) {
                reportedRefs.add(refKey);
                addReference(mdFile.path, {
                  exportName: className,
                  line: block.lineStart,
                  changeType: 'signature-changed',
                  context: `new ${className}(...)`,
                  isInstantiation: true,
                });
              }
            }
          }
        }
      }

      // 3. Fall back to export-level references for classes without member changes
      const exportsWithoutMemberChanges = changedExports.filter(
        (name) => !classesWithMemberChanges.has(name),
      );

      if (exportsWithoutMemberChanges.length > 0) {
        const refs = findExportReferences(
          [{ ...mdFile, codeBlocks: [block] }],
          exportsWithoutMemberChanges,
        );
        for (const ref of refs) {
          const changeType = getChangeType(ref.exportName, diff, newExportNames);
          if (!changeType) continue;

          const refKey = `${ref.file}:${ref.line}:${ref.exportName}`;
          if (!reportedRefs.has(refKey)) {
            reportedRefs.add(refKey);
            addReference(ref.file, {
              exportName: ref.exportName,
              line: ref.line,
              changeType,
              context: ref.context,
            });
          }
        }
      }
    }
  }

  // Find ALL exports that are documented in markdown files
  // Check all exports from the spec, not just new ones
  const documentedExportsSet = new Set<string>();
  for (const file of markdownFiles) {
    for (const block of file.codeBlocks) {
      // Check if export name appears in code block
      for (const exportName of newExportNames) {
        if (block.code.includes(exportName)) {
          documentedExportsSet.add(exportName);
        }
      }
    }
  }

  // New exports (from this diff) that are undocumented
  const missingDocs = diff.nonBreaking.filter((name) => !documentedExportsSet.has(name));

  // ALL exports that are undocumented (holistic view)
  const allUndocumented = newExportNames.filter((name) => !documentedExportsSet.has(name));

  // Calculate stats
  const totalCodeBlocks = markdownFiles.reduce((sum, f) => sum + f.codeBlocks.length, 0);
  const allReferences = findExportReferences(markdownFiles, [
    ...changedExports,
    ...diff.nonBreaking,
  ]);

  // Count total impacted references
  let impactedReferences = 0;
  for (const impact of impactByFile.values()) {
    impactedReferences += impact.references.length;
  }

  return {
    impactedFiles: Array.from(impactByFile.values()),
    missingDocs,
    allUndocumented,
    stats: {
      filesScanned: markdownFiles.length,
      codeBlocksFound: totalCodeBlocks,
      referencesFound: allReferences.length,
      impactedReferences,
      totalExports: newExportNames.length,
      documentedExports: documentedExportsSet.size,
    },
  };
}

/**
 * Find references to deprecated exports
 */
export function findDeprecatedReferences(
  markdownFiles: MarkdownDocFile[],
  deprecatedExports: string[],
): ExportReference[] {
  return findExportReferences(markdownFiles, deprecatedExports);
}

/**
 * Find references to removed exports
 */
export function findRemovedReferences(
  markdownFiles: MarkdownDocFile[],
  removedExports: string[],
): ExportReference[] {
  return findExportReferences(markdownFiles, removedExports);
}

/**
 * Check if any docs reference a specific export
 */
export function hasDocsForExport(markdownFiles: MarkdownDocFile[], exportName: string): boolean {
  const refs = findExportReferences(markdownFiles, [exportName]);
  return refs.length > 0;
}

/**
 * Get all exports that have documentation
 */
export function getDocumentedExports(
  markdownFiles: MarkdownDocFile[],
  exportNames: string[],
): string[] {
  const documented: string[] = [];
  for (const name of exportNames) {
    if (hasDocsForExport(markdownFiles, name)) {
      documented.push(name);
    }
  }
  return documented;
}

/**
 * Get all exports that lack documentation
 */
export function getUndocumentedExports(
  markdownFiles: MarkdownDocFile[],
  exportNames: string[],
): string[] {
  const documented = new Set(getDocumentedExports(markdownFiles, exportNames));
  return exportNames.filter((name) => !documented.has(name));
}
