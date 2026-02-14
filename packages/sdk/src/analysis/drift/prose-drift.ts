import { extractImportsAST, extractMethodCallsAST, type ImportInfo } from '../../markdown/ast-extractor';
import type { MarkdownDocFile } from '../../markdown/types';
import { ts } from '../../ts-module';
import type { ExportRegistry, SpecDocDrift } from './types';
import { findClosestMatch } from './utils';

/**
 * Common JS/TS built-in method names that appear on standard types (Map, Array, Promise, etc.).
 * When a locally-declared object calls one of these, we skip it — it's almost certainly
 * a standard library call, not a package API method.
 */
const JS_BUILTIN_METHODS = new Set([
  // Map/Set/WeakMap
  'get', 'set', 'has', 'delete', 'clear', 'keys', 'values', 'entries', 'forEach',
  // Array
  'push', 'pop', 'shift', 'unshift', 'map', 'filter', 'reduce', 'reduceRight',
  'find', 'findIndex', 'some', 'every', 'flat', 'flatMap', 'sort', 'reverse',
  'splice', 'slice', 'concat', 'includes', 'indexOf', 'lastIndexOf', 'join',
  'fill', 'at', 'from', 'of', 'copyWithin',
  // Promise
  'then', 'catch', 'finally',
  // Object
  'toString', 'valueOf', 'hasOwnProperty', 'toLocaleString',
  // String
  'split', 'trim', 'trimStart', 'trimEnd', 'replace', 'replaceAll',
  'match', 'matchAll', 'search', 'toLowerCase', 'toUpperCase',
  'startsWith', 'endsWith', 'padStart', 'padEnd', 'repeat',
  'substring', 'charAt', 'charCodeAt', 'codePointAt',
  // Event/DOM
  'addEventListener', 'removeEventListener', 'dispatchEvent',
  'appendChild', 'removeChild', 'querySelector', 'querySelectorAll',
  // Iterator
  'next', 'return', 'throw',
]);

export interface ProseDriftOptions {
  packageName: string;
  markdownFiles: MarkdownDocFile[];
  registry: ExportRegistry;
}

/**
 * Detect broken import references and unresolved member access
 * in markdown documentation code blocks.
 *
 * Two checks:
 * 1. Imports from the package that reference non-existent exports
 * 2. Method/property access on objects that don't match any exported type's members
 */
export function detectProseDrift(options: ProseDriftOptions): SpecDocDrift[] {
  const { packageName, markdownFiles, registry } = options;
  const issues: SpecDocDrift[] = [];

  for (const file of markdownFiles) {
    // File-level context: imports and declarations accumulate across blocks
    // (docs are sequential narratives — earlier blocks establish context)
    const fileExternalImports = new Set<string>();
    const fileLocalDeclarations = new Set<string>();
    const filePackageDerived = new Set<string>();

    for (const block of file.codeBlocks) {
      // Accumulate imports and declarations from this block
      accumulateBlockContext(
        block.code, packageName, fileExternalImports, fileLocalDeclarations,
        filePackageDerived, registry,
      );

      // 1. Check imports (existing behavior)
      detectBrokenImports(block.code, packageName, registry, file.path, block.lineStart, issues);

      // 2. Check method/property access against type members
      if (registry.typeMembers.size > 0) {
        detectUnresolvedMembers(
          block.code, packageName, registry, file.path, block.lineStart, issues,
          fileExternalImports, fileLocalDeclarations, filePackageDerived,
        );
      }
    }
  }

  return issues;
}

/**
 * Detect import statements referencing non-existent package exports.
 */
function detectBrokenImports(
  code: string,
  packageName: string,
  registry: ExportRegistry,
  filePath: string,
  lineStart: number,
  issues: SpecDocDrift[],
): void {
  let imports: ImportInfo[];
  try {
    imports = extractImportsAST(code);
  } catch {
    return;
  }

  const packageImports = imports.filter(
    (imp) => imp.from === packageName || imp.from.startsWith(`${packageName}/`),
  );

  for (const imp of packageImports) {
    if (imp.kind === 'side-effect') continue;
    if (registry.all.has(imp.name)) continue;
    // Skip subpath imports — registry only covers the main entry point
    if (imp.from !== packageName) continue;

    const match = findClosestMatch(imp.name, registry.allNames);
    const suggestion = match
      ? `Did you mean '${match.value}'?`
      : `'${imp.name}' is not exported from '${imp.from}'`;

    issues.push({
      type: 'prose-broken-reference',
      target: imp.name,
      issue: `Import '${imp.name}' from '${imp.from}' does not exist in package exports`,
      suggestion,
      filePath,
      line: lineStart,
    });
  }
}

/**
 * Accumulate imports and declarations from a code block into file-level sets.
 * Docs are sequential — `Cl` imported in block 1 is used in blocks 2–10.
 */
function accumulateBlockContext(
  code: string,
  packageName: string,
  externalImports: Set<string>,
  localDeclarations: Set<string>,
  packageDerived?: Set<string>,
  registry?: ExportRegistry,
): void {
  try {
    const imports = extractImportsAST(code);
    for (const imp of imports) {
      if (imp.kind === 'side-effect') continue;
      if (imp.from === packageName || imp.from.startsWith(`${packageName}/`)) continue;
      externalImports.add(imp.name);
    }
  } catch {
    // parse failure — skip
  }

  for (const name of extractLocalDeclarations(code)) {
    localDeclarations.add(name);
  }

  // Track variables derived from package export calls (e.g. `const simnet = await initSimnet()`)
  if (packageDerived && registry) {
    for (const name of extractPackageDerivedNames(code, registry)) {
      packageDerived.add(name);
    }
  }
}

/**
 * Detect method/property calls on objects that don't match any exported type's members.
 */
function detectUnresolvedMembers(
  code: string,
  packageName: string,
  registry: ExportRegistry,
  filePath: string,
  lineStart: number,
  issues: SpecDocDrift[],
  fileExternalImports: Set<string>,
  fileLocalDeclarations: Set<string>,
  filePackageDerived: Set<string>,
): void {
  let calls = extractMethodCallsAST(code);
  if (calls.length === 0) return;

  // Deduplicate: same objectName.methodName pair in the same block
  const seen = new Set<string>();
  calls = calls.filter((call) => {
    const key = `${call.objectName}.${call.methodName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const call of calls) {
    // Skip if the object itself is a known export
    if (registry.all.has(call.objectName)) continue;

    // Skip if the object is imported from an external package (this or prior blocks)
    if (fileExternalImports.has(call.objectName)) continue;

    // Skip objects derived from package export calls whose return type has no indexed members
    // (e.g. `const simnet = await initSimnet()` — Simnet type not fully resolved in registry)
    if (filePackageDerived.has(call.objectName)) continue;

    // For locally-declared objects, only skip built-in method names (get, set, map, etc.)
    // Domain-specific methods (callPublicFn, getDataVar, etc.) should still be validated
    if (fileLocalDeclarations.has(call.objectName) && JS_BUILTIN_METHODS.has(call.methodName)) continue;

    // Check if the method exists on ANY exported type
    const parentTypes = registry.typeMembers.get(call.methodName);
    if (parentTypes && parentTypes.size > 0) continue;

    // Method not found on any type — this is drift
    const match = findClosestMatch(call.methodName, registry.allMemberNames);
    const parentHint = match
      ? (() => {
          const matchParents = registry.typeMembers.get(match.value);
          return matchParents ? ` on ${Array.from(matchParents).join(', ')}` : '';
        })()
      : '';
    const suggestion = match
      ? `Did you mean '${match.value}'${parentHint}?`
      : `'${call.methodName}' does not exist on any exported type`;

    issues.push({
      type: 'prose-unresolved-member',
      target: `${call.objectName}.${call.methodName}`,
      issue: `Method '${call.methodName}' called on '${call.objectName}' does not exist on any exported type`,
      suggestion,
      filePath,
      line: lineStart + call.line,
    });
  }
}

/**
 * Extract all declared variable/function/class names from a code block,
 * walking recursively into function bodies, blocks, etc.
 */
function extractLocalDeclarations(code: string): Set<string> {
  const names = new Set<string>();

  try {
    const sourceFile = ts.createSourceFile('temp.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    const walk = (node: any) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        names.add(node.name.text);
      }
      if (ts.isFunctionDeclaration(node) && node.name) {
        names.add(node.name.text);
      }
      if (ts.isClassDeclaration(node) && node.name) {
        names.add(node.name.text);
      }
      // Also catch function parameters (e.g. arrow fn params)
      if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
        names.add(node.name.text);
      }
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
  } catch {
    // Fallback: simple regex for common patterns
    const declPattern = /(?:const|let|var|function|class)\s+(\w+)/g;
    let match: RegExpExecArray | null;
    while ((match = declPattern.exec(code)) !== null) {
      names.add(match[1]);
    }
  }

  return names;
}

/**
 * Find variables that are assigned from a call to a known package export.
 * e.g. `const simnet = await initSimnet()` — `initSimnet` is in registry.
 * These objects ARE the package API, but if their return type has no indexed
 * members in the registry, we can't validate method calls on them.
 */
function extractPackageDerivedNames(code: string, registry: ExportRegistry): Set<string> {
  const names = new Set<string>();

  try {
    const sourceFile = ts.createSourceFile('temp.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    const walk = (node: any) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        let expr = node.initializer;
        // Unwrap `await expr`
        if (ts.isAwaitExpression(expr)) expr = expr.expression;
        // Check `const x = knownExport(...)` pattern
        if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
          if (registry.all.has(expr.expression.text)) {
            names.add(node.name.text);
          }
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
  } catch {
    // Fallback: regex for `const x = [await] knownExport(...)`
    const pattern = /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(\w+)\s*\(/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) {
      if (registry.all.has(match[2])) {
        names.add(match[1]);
      }
    }
  }

  return names;
}
