import type * as TS from 'typescript';
import {
  extractImportsAST,
  extractMethodCallsAST,
  type ImportInfo,
} from '../../markdown/ast-extractor';
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
  'get',
  'set',
  'has',
  'delete',
  'clear',
  'keys',
  'values',
  'entries',
  'forEach',
  // Array
  'push',
  'pop',
  'shift',
  'unshift',
  'map',
  'filter',
  'reduce',
  'reduceRight',
  'find',
  'findIndex',
  'some',
  'every',
  'flat',
  'flatMap',
  'sort',
  'reverse',
  'splice',
  'slice',
  'concat',
  'includes',
  'indexOf',
  'lastIndexOf',
  'join',
  'fill',
  'at',
  'from',
  'of',
  'copyWithin',
  // Promise
  'then',
  'catch',
  'finally',
  // Object
  'toString',
  'valueOf',
  'hasOwnProperty',
  'toLocaleString',
  // String
  'split',
  'trim',
  'trimStart',
  'trimEnd',
  'replace',
  'replaceAll',
  'match',
  'matchAll',
  'search',
  'toLowerCase',
  'toUpperCase',
  'startsWith',
  'endsWith',
  'padStart',
  'padEnd',
  'repeat',
  'substring',
  'charAt',
  'charCodeAt',
  'codePointAt',
  // Event/DOM
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  'appendChild',
  'removeChild',
  'querySelector',
  'querySelectorAll',
  // Iterator
  'next',
  'return',
  'throw',
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
    const filePackageDerivedTypes = new Map<string, string>();
    const fileExternalDerived = new Set<string>();
    const fileNonPackageParams = new Set<string>();
    const flaggedDeprecated = new Set<string>();

    for (const block of file.codeBlocks) {
      // Accumulate imports and declarations from this block
      accumulateBlockContext(
        block.code,
        packageName,
        fileExternalImports,
        fileLocalDeclarations,
        filePackageDerived,
        registry,
        filePackageDerivedTypes,
        fileExternalDerived,
        fileNonPackageParams,
      );

      // 1. Check imports (existing behavior)
      detectBrokenImports(block.code, packageName, registry, file.path, block.lineStart, issues);

      // 2. Check method/property access against type members
      if (registry.typeMembers.size > 0) {
        detectUnresolvedMembers(
          block.code,
          packageName,
          registry,
          file.path,
          block.lineStart,
          issues,
          fileExternalImports,
          fileLocalDeclarations,
          filePackageDerived,
          fileExternalDerived,
          fileNonPackageParams,
        );
      }

      // 3. Check references to deprecated exports/members without a deprecation note
      if (registry.deprecated.size > 0 || registry.deprecatedMembers.size > 0) {
        detectDeprecatedReferences(
          block,
          file,
          packageName,
          registry,
          issues,
          fileExternalImports,
          flaggedDeprecated,
          filePackageDerivedTypes,
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
  packageDerivedTypes?: Map<string, string>,
  externalDerived?: Set<string>,
  nonPackageParams?: Set<string>,
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
    for (const [name, exportName] of extractPackageDerivedNames(code, registry)) {
      packageDerived.add(name);
      const returnType = registry.callableReturnTypes.get(exportName);
      if (packageDerivedTypes && returnType) packageDerivedTypes.set(name, returnType);
    }
  }

  // Track receivers provably bound to non-package types: variables derived
  // from external-import calls (`const app = express()`) and function
  // parameters not annotated with a package type (`(req, res) => …`). Their
  // methods aren't ours to validate.
  if (externalDerived && nonPackageParams) {
    extractNonPackageReceivers(code, externalImports, registry, externalDerived, nonPackageParams);
  }
}

/**
 * Find receivers bound to non-package types:
 * - `const x = ext(...)` / `new Ext(...)` where `ext` is an external import
 * - function parameters without a type annotation naming a package export
 */
function extractNonPackageReceivers(
  code: string,
  externalImports: Set<string>,
  registry: ExportRegistry | undefined,
  externalDerived: Set<string>,
  nonPackageParams: Set<string>,
): void {
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const walk = (node: TS.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        let expr: TS.Expression = node.initializer;
        if (ts.isAwaitExpression(expr)) expr = expr.expression;
        if (
          (ts.isCallExpression(expr) || ts.isNewExpression(expr)) &&
          ts.isIdentifier(expr.expression) &&
          externalImports.has(expr.expression.text)
        ) {
          externalDerived.add(node.name.text);
        }
      }
      if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
        // Keep validating params explicitly annotated with a package type
        const typeName = node.type?.getText(sourceFile).split('<')[0].trim();
        if (!typeName || !registry?.all.has(typeName)) {
          nonPackageParams.add(node.name.text);
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
  } catch {
    // parse failure — skip
  }
}

/**
 * Detect method/property calls on objects that don't match any exported type's members.
 */
function detectUnresolvedMembers(
  code: string,
  _packageName: string,
  registry: ExportRegistry,
  filePath: string,
  lineStart: number,
  issues: SpecDocDrift[],
  fileExternalImports: Set<string>,
  fileLocalDeclarations: Set<string>,
  filePackageDerived: Set<string>,
  fileExternalDerived: Set<string>,
  fileNonPackageParams: Set<string>,
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

    // Skip receivers provably bound to non-package types: derived from an
    // external import (`const app = express()`) or a function parameter not
    // annotated with a package type (`(req, res) => res.sendStatus(200)`)
    if (fileExternalDerived.has(call.objectName)) continue;
    if (fileNonPackageParams.has(call.objectName)) continue;

    // For locally-declared objects, only skip built-in method names (get, set, map, etc.)
    // Domain-specific methods (callPublicFn, getDataVar, etc.) should still be validated
    if (fileLocalDeclarations.has(call.objectName) && JS_BUILTIN_METHODS.has(call.methodName))
      continue;

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
 * Detect references to deprecated exports/members in code blocks whose
 * surrounding prose never acknowledges the deprecation.
 *
 * Deterministic and conservative:
 * - imports of deprecated exports from the package
 * - member calls whose name is deprecated on every type that declares it
 * - suppressed when "deprecat…" appears within ±5 lines of the block
 * - one finding per name per file
 */
function detectDeprecatedReferences(
  block: { code: string; lineStart: number; lineEnd: number },
  file: MarkdownDocFile,
  packageName: string,
  registry: ExportRegistry,
  issues: SpecDocDrift[],
  fileExternalImports: Set<string>,
  flaggedDeprecated: Set<string>,
  packageDerivedTypes: Map<string, string>,
): void {
  if (hasDeprecationContext(file, block.lineStart, block.lineEnd)) return;

  const push = (name: string, note: string, line: number) => {
    if (flaggedDeprecated.has(name)) return;
    flaggedDeprecated.add(name);
    issues.push({
      type: 'prose-deprecated-reference',
      target: name,
      issue: `Docs reference deprecated API '${name}' without noting the deprecation`,
      suggestion: note
        ? `Deprecation note: ${note}`
        : 'Add a deprecation note or update the docs to the replacement API',
      filePath: file.path,
      line,
    });
  };

  // Imports of deprecated exports
  try {
    for (const imp of extractImportsAST(block.code)) {
      if (imp.kind === 'side-effect') continue;
      if (imp.from !== packageName && !imp.from.startsWith(`${packageName}/`)) continue;
      const note = registry.deprecated.get(imp.name);
      if (note !== undefined) push(imp.name, note, block.lineStart);
    }
  } catch {
    // parse failure — skip imports check
  }

  // Member calls on deprecated members. When the object's type is known
  // (derived from a package call, e.g. `const simnet = await initSimnet()` →
  // Simnet), judge against that type directly. Otherwise only flag when
  // unambiguous: every type declaring this member marks it deprecated.
  for (const call of extractMethodCallsAST(block.code)) {
    if (JS_BUILTIN_METHODS.has(call.methodName)) continue;
    if (fileExternalImports.has(call.objectName)) continue;
    const dep = registry.deprecatedMembers.get(call.methodName);
    if (!dep) continue;

    const knownType = packageDerivedTypes.get(call.objectName);
    if (knownType) {
      if (dep.parents.has(knownType)) {
        push(call.methodName, dep.note, block.lineStart + call.line);
      }
      continue;
    }

    const declaredOn = registry.typeMembers.get(call.methodName);
    if (declaredOn && [...declaredOn].some((parent) => !dep.parents.has(parent))) continue;
    push(call.methodName, dep.note, block.lineStart + call.line);
  }
}

/** True when the prose around a code block already mentions deprecation. */
function hasDeprecationContext(file: MarkdownDocFile, lineStart: number, lineEnd: number): boolean {
  if (!file.content) return false;
  const lines = file.content.split('\n');
  const from = Math.max(0, lineStart - 1 - 5);
  const to = Math.min(lines.length, lineEnd + 5);
  return /deprecat/i.test(lines.slice(from, to).join('\n'));
}

/**
 * Extract all declared variable/function/class names from a code block,
 * walking recursively into function bodies, blocks, etc.
 */
function extractLocalDeclarations(code: string): Set<string> {
  const names = new Set<string>();

  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const walk = (node: TS.Node) => {
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
    for (const match of code.matchAll(declPattern)) {
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
function extractPackageDerivedNames(code: string, registry: ExportRegistry): Map<string, string> {
  const names = new Map<string, string>();

  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const walk = (node: TS.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        let expr: TS.Expression = node.initializer;
        // Unwrap `await expr`
        if (ts.isAwaitExpression(expr)) expr = expr.expression;
        // `const x = knownExport(...)` and `const x = new KnownClass(...)`
        if (
          (ts.isCallExpression(expr) || ts.isNewExpression(expr)) &&
          ts.isIdentifier(expr.expression)
        ) {
          if (registry.all.has(expr.expression.text)) {
            names.set(node.name.text, expr.expression.text);
          }
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
  } catch {
    // Fallback: regex for `const x = [await] [new] knownExport(...)`
    const pattern = /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:new\s+)?(\w+)\s*\(/g;
    for (const match of code.matchAll(pattern)) {
      if (registry.all.has(match[2])) {
        names.set(match[1], match[2]);
      }
    }
  }

  return names;
}
