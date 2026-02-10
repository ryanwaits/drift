import { extractImportsAST } from '../../markdown/ast-extractor';
import type { MarkdownDocFile } from '../../markdown/types';
import type { ExportRegistry, SpecDocDrift } from './types';
import { findClosestMatch } from './utils';

export interface ProseDriftOptions {
  packageName: string;
  markdownFiles: MarkdownDocFile[];
  registry: ExportRegistry;
}

/**
 * Detect broken import references in markdown documentation code blocks.
 *
 * Scans code blocks for imports from the package and verifies each imported
 * name exists in the export registry.
 */
export function detectProseDrift(options: ProseDriftOptions): SpecDocDrift[] {
  const { packageName, markdownFiles, registry } = options;
  const issues: SpecDocDrift[] = [];

  for (const file of markdownFiles) {
    for (const block of file.codeBlocks) {
      let imports;
      try {
        imports = extractImportsAST(block.code);
      } catch {
        continue;
      }

      const packageImports = imports.filter(
        (imp) => imp.from === packageName || imp.from.startsWith(`${packageName}/`),
      );

      for (const imp of packageImports) {
        if (imp.kind === 'side-effect') continue;
        if (registry.all.has(imp.name)) continue;

        const match = findClosestMatch(imp.name, registry.allNames);
        const suggestion = match
          ? `Did you mean '${match.value}'?`
          : `'${imp.name}' is not exported from '${imp.from}'`;

        issues.push({
          type: 'prose-broken-reference',
          target: imp.name,
          issue: `Import '${imp.name}' from '${imp.from}' does not exist in package exports`,
          suggestion,
          filePath: file.path,
          line: block.lineStart,
        });
      }
    }
  }

  return issues;
}
