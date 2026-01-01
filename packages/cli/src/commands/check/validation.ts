import type { ExampleTypeError, ExampleValidation, ExampleValidationResult } from '@doccov/sdk';
import { validateExamples } from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
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
}

/**
 * Detect stale references in markdown docs
 */
export async function validateMarkdownDocs(
  options: MarkdownValidationOptions,
): Promise<StaleReference[]> {
  const { docsPatterns, targetDir, exportNames } = options;
  const staleRefs: StaleReference[] = [];

  if (docsPatterns.length === 0) {
    return staleRefs;
  }

  const markdownFiles = await loadMarkdownFiles(docsPatterns, targetDir);

  if (markdownFiles.length === 0) {
    return staleRefs;
  }

  const exportSet = new Set(exportNames);

  // Check each code block for imports that reference non-existent exports
  for (const mdFile of markdownFiles) {
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
