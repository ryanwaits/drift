import type { SpecExport } from '@openpkg-ts/spec';
import ts from 'typescript';
import { isBuiltInIdentifier } from '../../utils/builtin-detection';
import type { ExampleRunResult } from '../../utils/example-runner';
import type { ExportRegistry, SpecDocDrift } from './types';
import { findClosestMatch } from './utils';

// ─────────────────────────────────────────────────────────────────────────────
// AST Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine how an identifier is used in the AST.
 * Returns 'call' for function calls, 'type' for type annotations, 'value' otherwise.
 */
function getIdentifierContext(node: ts.Identifier): 'call' | 'type' | 'value' {
  const parent = node.parent;
  if (!parent) return 'value';

  // Function call: foo() or new Foo()
  if (ts.isCallExpression(parent) && parent.expression === node) return 'call';
  if (ts.isNewExpression(parent) && parent.expression === node) return 'call';

  // Type reference: const x: Foo or <Foo>
  if (ts.isTypeReferenceNode(parent)) return 'type';
  if (ts.isExpressionWithTypeArguments(parent)) return 'type';

  return 'value';
}

/**
 * Check if an identifier node is a local declaration (class, function, variable name).
 */
function isLocalDeclaration(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;

  if (ts.isClassDeclaration(parent) && parent.name === node) return true;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;

  return false;
}

/**
 * Check if an identifier node is a reference (not a declaration).
 * Returns false only for declaration sites where the identifier is being defined.
 * Import specifiers and type references ARE valid references that should be checked.
 */
function isIdentifierReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;

  // Skip: declarations (class Foo, function Foo, const Foo = ...)
  // These define the identifier, not reference it
  if (ts.isClassDeclaration(parent) && parent.name === node) return false;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return false;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return false;
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return false;

  // Skip: property access names (Cl.standardPrincipal - don't check standardPrincipal)
  // The property is accessed on an object, not referenced as a standalone export
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;

  // Import specifiers and type references ARE valid references:
  // - import { Foo } from 'pkg' - Foo should exist
  // - const x: Foo = ... - Foo should exist

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Example Drift Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect references to non-existent exports in @example code blocks.
 */
export function detectExampleDrift(entry: SpecExport, registry?: ExportRegistry): SpecDocDrift[] {
  if (!registry || !entry.examples?.length) return [];

  const drifts: SpecDocDrift[] = [];

  for (const example of entry.examples) {
    if (typeof example !== 'string') continue;

    // Strip markdown code block markers if present
    const codeContent = example
      .replace(/^```(?:ts|typescript|js|javascript)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    if (!codeContent) continue;

    // Parse as AST - this automatically excludes comments and string literals
    const sourceFile = ts.createSourceFile(
      'example.ts',
      codeContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const localDeclarations = new Set<string>();
    // Track identifiers with their usage context
    const referencedIdentifiers = new Map<string, 'call' | 'type' | 'value'>();

    // Walk AST to find local declarations and identifier references
    function visit(node: ts.Node) {
      if (ts.isIdentifier(node)) {
        const text = node.text;
        // Skip very short identifiers (single letters are usually local vars)
        if (text.length <= 1) {
          ts.forEachChild(node, visit);
          return;
        }

        if (isLocalDeclaration(node)) {
          // Track locally declared identifiers so we don't flag them as missing
          localDeclarations.add(text);
        } else if (isIdentifierReference(node) && !isBuiltInIdentifier(text)) {
          // Track with context (prefer 'call' over other contexts if seen multiple times)
          const context = getIdentifierContext(node);
          const existing = referencedIdentifiers.get(text);
          if (!existing || context === 'call') {
            referencedIdentifiers.set(text, context);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);

    // Remove local declarations from references (they're defined in the example)
    for (const local of localDeclarations) {
      referencedIdentifiers.delete(local);
    }

    // Check if referenced identifiers exist in registry
    for (const [identifier, context] of referencedIdentifiers) {
      if (!registry.all.has(identifier)) {
        // Get context-appropriate candidates for suggestions
        let candidates: string[];
        if (context === 'call') {
          // For function calls, only suggest callable exports (functions, classes)
          candidates = Array.from(registry.exports.values())
            .filter((e) => e.isCallable)
            .map((e) => e.name);
        } else if (context === 'type') {
          // For type references, suggest types and type-like exports (interfaces, classes)
          candidates = [
            ...Array.from(registry.types),
            ...Array.from(registry.exports.values())
              .filter((e) => ['class', 'interface', 'type', 'enum'].includes(e.kind))
              .map((e) => e.name),
          ];
        } else {
          // For value references, suggest all exports (not types)
          candidates = Array.from(registry.exports.keys());
        }

        const suggestion = findClosestMatch(identifier, candidates);

        // Only report drift if there's a close match (likely typo)
        // or if the identifier looks like a type/class name (PascalCase)
        const isPascal = /^[A-Z]/.test(identifier);
        const hasCloseMatch = suggestion && suggestion.distance <= 5;

        if (hasCloseMatch || isPascal) {
          drifts.push({
            type: 'example-drift',
            target: identifier,
            issue: `@example references "${identifier}" which does not exist in this package.`,
            suggestion: hasCloseMatch ? `Did you mean "${suggestion.value}"?` : undefined,
          });
        }
      }
    }
  }

  return drifts;
}

/**
 * Detect syntax errors in @example code blocks.
 */
export function detectExampleSyntaxErrors(entry: SpecExport): SpecDocDrift[] {
  if (!entry.examples || entry.examples.length === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  for (let i = 0; i < entry.examples.length; i++) {
    const example = entry.examples[i];
    if (typeof example !== 'string') continue;

    // Strip markdown code block markers if present
    const codeContent = example
      .replace(/^```(?:ts|typescript|js|javascript)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    if (!codeContent) continue;

    // Try to parse as TypeScript/JavaScript
    const sourceFile = ts.createSourceFile(
      `example-${i}.ts`,
      codeContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    // Check for parse diagnostics
    const parseDiagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] })
      .parseDiagnostics;

    if (parseDiagnostics && parseDiagnostics.length > 0) {
      const firstError = parseDiagnostics[0];
      const message = ts.flattenDiagnosticMessageText(firstError.messageText, '\n');

      drifts.push({
        type: 'example-syntax-error',
        target: `example[${i}]`,
        issue: `@example contains invalid syntax: ${message}`,
        suggestion: 'Check for missing brackets, semicolons, or typos.',
      });
    }
  }

  return drifts;
}

/**
 * Detect runtime errors in @example blocks.
 * Results are provided externally after running examples via runExamples().
 */
export function detectExampleRuntimeErrors(
  entry: SpecExport,
  runtimeResults: Map<number, ExampleRunResult>,
): SpecDocDrift[] {
  if (!entry.examples || entry.examples.length === 0 || runtimeResults.size === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  for (let i = 0; i < entry.examples.length; i++) {
    const result = runtimeResults.get(i);
    if (!result || result.success) {
      continue;
    }

    // Extract meaningful error message
    const errorMessage = extractErrorMessage(result.stderr);
    const isTimeout = result.stderr.includes('timed out');

    drifts.push({
      type: 'example-runtime-error',
      target: `example[${i}]`,
      issue: isTimeout
        ? `@example timed out after ${result.duration}ms.`
        : `@example throws at runtime: ${errorMessage}`,
      suggestion: isTimeout
        ? 'Check for infinite loops or long-running operations.'
        : 'Fix the example code or update it to match the current API.',
    });
  }

  return drifts;
}

function extractErrorMessage(stderr: string): string {
  // Try to extract just the error message, not the full stack trace
  const lines = stderr.split('\n').filter((line) => line.trim());
  if (lines.length === 0) {
    return 'Unknown error';
  }

  // Look for common error patterns
  for (const line of lines) {
    const errorMatch = line.match(/^(?:Error|TypeError|ReferenceError|SyntaxError):\s*(.+)/);
    if (errorMatch) {
      return errorMatch[0];
    }
  }

  // Return first non-empty line, truncated
  const firstLine = lines[0] ?? 'Unknown error';
  return firstLine.length > 100 ? `${firstLine.slice(0, 100)}...` : firstLine;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assertions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse assertion comments from example code.
 * Matches: // => expected_value
 */
export function parseAssertions(code: string): Array<{ lineNumber: number; expected: string }> {
  const assertions: Array<{ lineNumber: number; expected: string }> = [];

  // Strip markdown code block markers
  const cleanCode = code
    .replace(/^```(?:ts|typescript|js|javascript)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  const lines = cleanCode.split('\n');
  const assertionPattern = /\/\/\s*=>\s*(.+?)\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(assertionPattern);
    if (match?.[1]) {
      assertions.push({
        lineNumber: i + 1,
        expected: match[1].trim(),
      });
    }
  }

  return assertions;
}

/**
 * Check if code contains comments that are not assertion syntax.
 * Used to determine if LLM fallback should be attempted.
 */
export function hasNonAssertionComments(code: string): boolean {
  // Check for any // comments that are not // =>
  return /\/\/(?!\s*=>)/.test(code);
}

/**
 * Detect assertion failures by comparing stdout to expected values.
 */
export function detectExampleAssertionFailures(
  entry: SpecExport,
  runtimeResults: Map<number, ExampleRunResult>,
): SpecDocDrift[] {
  if (!entry.examples || entry.examples.length === 0 || runtimeResults.size === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  for (let i = 0; i < entry.examples.length; i++) {
    const example = entry.examples[i];
    const result = runtimeResults.get(i);

    // Only check assertions if example ran successfully
    if (!result || !result.success || typeof example !== 'string') {
      continue;
    }

    const assertions = parseAssertions(example);
    if (assertions.length === 0) {
      continue;
    }

    // Parse stdout into lines (normalized)
    const stdoutLines = result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Compare each assertion with corresponding stdout line
    for (let j = 0; j < assertions.length; j++) {
      const assertion = assertions[j];
      const actual = stdoutLines[j];

      if (actual === undefined) {
        drifts.push({
          type: 'example-assertion-failed',
          target: `example[${i}]:line${assertion.lineNumber}`,
          issue: `Assertion expected "${assertion.expected}" but no output was produced`,
          suggestion: 'Ensure the example produces output for each assertion',
        });
        continue;
      }

      // Normalized comparison (trim whitespace)
      if (assertion.expected.trim() !== actual.trim()) {
        drifts.push({
          type: 'example-assertion-failed',
          target: `example[${i}]:line${assertion.lineNumber}`,
          issue: `Assertion failed: expected "${assertion.expected}" but got "${actual}"`,
          suggestion: `Update assertion to: // => ${actual}`,
        });
      }
    }
  }

  return drifts;
}
