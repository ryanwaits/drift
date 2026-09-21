import type * as TS from 'typescript';
import {
  extractImportsAST,
  extractMethodCallsAST,
  type ImportInfo,
} from '../../markdown/ast-extractor';
import type { MarkdownDocFile } from '../../markdown/types';
import {
  collectPackageNamespaces,
  declaredBindings,
  extractFenceCalls,
  fenceImportKind,
  isMigrationFence,
} from '../../page/fences';
import { collectHeadings, sectionText } from '../../page/locators';
import {
  destructuredTypeName,
  namedReturnType,
  parseDeprecationReplacement,
  signaturesOf,
} from '../../page/spec-ref';
import { ts } from '../../ts-module';
import type { ApiSpec } from '../api-spec';
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

/** Receivers that are never the package API. */
const GLOBAL_RECEIVERS = new Set([
  'crypto',
  'React',
  'window',
  'document',
  'console',
  'Math',
  'JSON',
  'process',
  'Buffer',
  'globalThis',
  'Intl',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'fetch',
  'Date',
  'Promise',
  'Array',
  'Object',
  'Map',
  'Set',
]);

/** Inputs for `detectProseDrift`: package name, markdown corpus, export registry. */
export interface ProseDriftOptions {
  packageName: string;
  markdownFiles: MarkdownDocFile[];
  registry: ExportRegistry;
  /**
   * Module specifier whose imports are checked (`prose-broken-reference`).
   * Defaults to `packageName`. Pass `jotai/utils` when the spec is that
   * `package.json` `exports` path so `import { atom } from 'jotai'` is silent.
   */
  importSpecifier?: string;
  /**
   * The spec behind `registry`. With it, a destructured element
   * (`const { room } = useRoom()`) is typed as its own property; without it,
   * destructured names are never receivers.
   */
  spec?: ApiSpec;
}

/**
 * Detect broken import references and unresolved member access
 * in markdown documentation code blocks.
 *
 * Two checks:
 * 1. Imports from the package that reference non-existent exports
 * 2. Method/property access on receivers typed as a package class/interface
 *    that don't exist on that type. Unknown receivers (db, jwt, crypto) and
 *    generic wrappers (`Snapshot<T>`, `ExtractState<S>`) are not flagged.
 */
export function detectProseDrift(options: ProseDriftOptions): SpecDocDrift[] {
  const { packageName, markdownFiles, registry, importSpecifier, spec } = options;
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
    const filePackageParamTypes = new Map<string, string>();
    const flaggedDeprecated = new Set<string>();
    const { namespaces, aliases } = collectPackageNamespaces(
      file.codeBlocks.map((b) => b.code),
      registry.all,
      packageName,
      importSpecifier,
      registry.localNames,
    );

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
        filePackageParamTypes,
        spec,
        namespaces,
      );

      const skipFence =
        isMigrationFence(file.content, block.lineStart, block.code) ||
        fenceImportKind(block.code, packageName, importSpecifier) === 'foreign';

      // 1. Check imports (existing behavior)
      detectBrokenImports(
        block.code,
        packageName,
        registry,
        file.path,
        block.lineStart,
        issues,
        importSpecifier,
      );

      if (!skipFence) {
        detectNamespaceExportRefs(
          block.code,
          namespaces,
          registry,
          file.path,
          block.lineStart,
          issues,
          importSpecifier ?? packageName,
        );
      }

      // 2. Check method/property access against type members
      if (!skipFence && registry.typeMembers.size > 0) {
        detectUnresolvedMembers(
          block.code,
          registry,
          file.path,
          block.lineStart,
          issues,
          filePackageDerivedTypes,
          filePackageParamTypes,
          namespaces,
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
          flaggedDeprecated,
          {
            derived: filePackageDerivedTypes,
            params: filePackageParamTypes,
            namespaces,
            aliases,
            notOurs: new Set([...fileExternalImports, ...fileLocalDeclarations]),
          },
          spec,
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
  importSpecifier?: string,
): void {
  let imports: ImportInfo[];
  try {
    imports = extractImportsAST(code);
  } catch {
    return;
  }

  const from = importSpecifier ?? packageName;
  const packageImports = imports.filter((imp) => imp.from === from);

  for (const imp of packageImports) {
    if (imp.kind !== 'named') continue;
    if (imp.invalidPair) {
      const alias = `${imp.imported} as ${imp.name}`;
      issues.push({
        type: 'prose-broken-reference',
        target: imp.invalidPair,
        issue: `\`${imp.invalidPair}\` is not valid import syntax; did you mean \`${alias}\`?`,
        suggestion: alias,
        filePath,
        line: lineStart,
      });
    }
    // `import { a as b }` is a claim about `a`. A default import (either
    // spelling) names no export.
    const name = imp.imported;
    if (name === 'default' || registry.all.has(name)) continue;

    const match = findClosestMatch(name, registry.allNames);
    const suggestion =
      registry.localNames?.get(name) === 'default'
        ? `'${name}' is the default export: import ${name} from '${imp.from}'`
        : match
          ? `Did you mean '${match.value}'?`
          : `'${name}' is not exported from '${imp.from}'`;

    issues.push({
      type: 'prose-broken-reference',
      target: name,
      issue: `Import '${name}' from '${imp.from}' does not exist in package exports`,
      suggestion,
      filePath,
      line: lineStart,
    });
  }
}

/**
 * `ns.member` on a package namespace alias is the export `member`.
 * The alias itself is never a broken reference.
 */
function detectNamespaceExportRefs(
  code: string,
  namespaces: ReadonlySet<string>,
  registry: ExportRegistry,
  filePath: string,
  lineStart: number,
  issues: SpecDocDrift[],
  specifier: string,
): void {
  if (namespaces.size === 0) return;
  for (const call of extractFenceCalls(code)) {
    if (!namespaces.has(call.objectName)) continue;
    if (JS_BUILTIN_METHODS.has(call.methodName)) continue;
    if (registry.all.has(call.methodName)) continue;
    const match = findClosestMatch(call.methodName, registry.allNames);
    issues.push({
      type: 'prose-broken-reference',
      target: `${call.objectName}.${call.methodName}`,
      issue: `'${call.methodName}' on '${call.objectName}' does not exist in package exports`,
      suggestion: match
        ? `Did you mean '${match.value}'?`
        : `'${call.methodName}' is not exported from '${specifier}'`,
      filePath,
      line: lineStart + call.line,
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
  packageParamTypes?: Map<string, string>,
  spec?: ApiSpec,
  namespaces?: ReadonlySet<string>,
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
    for (const [name, returnType] of extractPackageDerivedNames(code, registry, spec, namespaces)) {
      packageDerived.add(name);
      if (returnType) packageDerivedTypes?.set(name, returnType);
      else packageDerivedTypes?.delete(name);
    }
  }

  // Track receivers provably bound to non-package types: variables derived
  // from external-import calls (`const app = express()`) and function
  // parameters not annotated with a package type (`(req, res) => …`). Their
  // methods aren't ours to validate.
  if (externalDerived && nonPackageParams) {
    extractNonPackageReceivers(
      code,
      externalImports,
      registry,
      externalDerived,
      nonPackageParams,
      packageParamTypes,
    );
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
  packageParamTypes?: Map<string, string>,
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
        if (typeName && registry?.all.has(typeName)) {
          packageParamTypes?.set(node.name.text, typeName);
        } else {
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
 * Receiver we can judge: a var derived from a package call
 * (`const x = new PostHog()` → PostHog) or a param annotated with a package
 * type. An identifier that merely matches an export or type name is not a
 * binding (`Schema.decode`, `value.toISOString`).
 */
function packageReceiverType(
  objectName: string,
  packageDerivedTypes: Map<string, string>,
  packageParamTypes: Map<string, string>,
): string | undefined {
  const derived = packageDerivedTypes.get(objectName);
  if (derived) return derived;
  const annotated = packageParamTypes.get(objectName);
  if (annotated) return annotated;
  return undefined;
}

/**
 * Detect method/property calls on package-typed receivers that don't exist
 * on that type. Unknown receivers are not flagged.
 */
function detectUnresolvedMembers(
  code: string,
  registry: ExportRegistry,
  filePath: string,
  lineStart: number,
  issues: SpecDocDrift[],
  packageDerivedTypes: Map<string, string>,
  packageParamTypes: Map<string, string>,
  namespaces: ReadonlySet<string> = new Set(),
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
    if (GLOBAL_RECEIVERS.has(call.objectName)) continue;
    if (namespaces.has(call.objectName)) continue;
    if (JS_BUILTIN_METHODS.has(call.methodName)) continue;
    const typeName = packageReceiverType(call.objectName, packageDerivedTypes, packageParamTypes);
    if (!typeName) continue;
    if (!registry.closedReceivers.has(typeName)) continue;
    if (registry.typeMembers.get(call.methodName)?.has(typeName)) continue;

    // Only members of the receiver's own type: another type's member is no fix.
    const own = registry.allMemberNames.filter((m) => registry.typeMembers.get(m)?.has(typeName));
    const match = findClosestMatch(call.methodName, own);
    const suggestion = match
      ? `Did you mean '${match.value}' on ${typeName}?`
      : `'${call.methodName}' is not a member of '${typeName}'`;

    issues.push({
      type: 'prose-unresolved-member',
      target: `${call.objectName}.${call.methodName}`,
      issue: `Method '${call.methodName}' called on '${call.objectName}' does not exist on '${typeName}'`,
      suggestion,
      filePath,
      line: lineStart + call.line,
      owner: typeName,
    });
  }
}

/** What a fence identifier is known to be, for resolving a reference. */
type ReferenceScope = {
  /** Variable → spec type, from a package call / `new` */
  derived: ReadonlyMap<string, string>;
  /** Parameter → annotated package type */
  params: ReadonlyMap<string, string>;
  /** `import * as ns` aliases of the package */
  namespaces: ReadonlySet<string>;
  /** Renamed / default imports: local → export */
  aliases: ReadonlyMap<string, string>;
  /** Imported from elsewhere or declared on the page: never the export of that name */
  notOurs: ReadonlySet<string>;
};

/** Export a callee names: `f(...)` or `ns.f(...)`. Undefined for anything else. */
function calleeExport(
  callee: TS.Expression,
  registry: ExportRegistry,
  scope: ReferenceScope,
): string | undefined {
  if (ts.isIdentifier(callee)) {
    if (scope.notOurs.has(callee.text)) return undefined;
    const name = scope.aliases.get(callee.text) ?? callee.text;
    return registry.all.has(name) ? name : undefined;
  }
  if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    scope.namespaces.has(callee.expression.text)
  ) {
    return registry.all.has(callee.name.text) ? callee.name.text : undefined;
  }
  return undefined;
}

/**
 * Spec type of an expression, through visible bindings and spec return types
 * only: a bound variable, `new T()`, `f()` / `ns.f()` (first overload, no
 * explicit type arguments), `x.m()` where the spec says what `T.m` returns
 * (`this` stays `T`). Undefined the moment a link is not certain.
 */
function expressionType(
  expr: TS.Expression,
  registry: ExportRegistry,
  scope: ReferenceScope,
  spec?: ApiSpec,
): string | undefined {
  let e = expr;
  while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAwaitExpression(e)) {
    e = e.expression;
  }
  if (ts.isIdentifier(e)) return scope.derived.get(e.text) ?? scope.params.get(e.text);
  if (ts.isNewExpression(e)) {
    const name = calleeExport(e.expression, registry, scope);
    return name && registry.closedReceivers.has(name) ? name : undefined;
  }
  if (!ts.isCallExpression(e) || e.typeArguments?.length) return undefined;
  const exportName = calleeExport(e.expression, registry, scope);
  if (exportName) return registry.callableReturnTypes.get(exportName);
  if (!spec || !ts.isPropertyAccessExpression(e.expression)) return undefined;
  const owner = expressionType(e.expression.expression, registry, scope, spec);
  if (!owner) return undefined;
  const returns = signaturesOf(spec, owner, e.expression.name.text)[0]?.returns?.schema;
  if (returns && typeof returns === 'object' && returns['x-ts-type'] === 'this') return owner;
  return namedReturnType(returns);
}

/**
 * Detect references to deprecated exports/members in code blocks whose
 * surrounding prose never acknowledges the deprecation.
 *
 * The check is on the resolved reference, never on a bare name:
 * - imports of deprecated exports from the package
 * - `f(...)` / `ns.f(...)` is the export `f`: deprecated only if that export is.
 *   `z.url()` is never the deprecated method `ZodString.url`
 * - `x.m(...)` is `T.m` only when `x` is `T` through a binding or a chain of
 *   spec return types (`z.string().url()`); an unknown receiver is silent
 * - suppressed when "deprecat…" appears within ±5 lines of the block
 * - suppressed when the block's section (nearest heading's section, intros of
 *   the headings above it, frontmatter; whole page under the H1) says
 *   deprecated / no longer maintained / legacy, or names the replacement
 * - one finding per name per file
 */
function detectDeprecatedReferences(
  block: { code: string; lineStart: number; lineEnd: number },
  file: MarkdownDocFile,
  packageName: string,
  registry: ExportRegistry,
  issues: SpecDocDrift[],
  flaggedDeprecated: Set<string>,
  scope: ReferenceScope,
  spec?: ApiSpec,
): void {
  if (hasDeprecationContext(file, block.lineStart, block.lineEnd)) return;
  const section = file.content
    ? sectionText(file.content, collectHeadings(file.content), block.lineStart)
    : '';
  if (DEPRECATION_NOTE.test(section)) return;

  const push = (name: string, note: string, line: number, owner?: string) => {
    const key = owner ? `${owner}.${name}` : name;
    if (flaggedDeprecated.has(key)) return;
    const replacement = parseDeprecationReplacement(note);
    if (replacement && wordRe(replacement).test(section)) return;
    flaggedDeprecated.add(key);
    issues.push({
      type: 'prose-deprecated-reference',
      target: name,
      issue: `Docs reference deprecated API '${key}' without noting the deprecation`,
      suggestion: note
        ? `Deprecation note: ${note}`
        : 'Add a deprecation note or update the docs to the replacement API',
      filePath: file.path,
      line,
      ...(owner ? { owner } : {}),
    });
  };

  // Imports of deprecated exports
  try {
    for (const imp of extractImportsAST(block.code)) {
      if (imp.kind === 'side-effect') continue;
      if (imp.from !== packageName && !imp.from.startsWith(`${packageName}/`)) continue;
      const note = registry.deprecated.get(imp.imported);
      if (note !== undefined) push(imp.imported, note, block.lineStart);
    }
  } catch {
    // parse failure — skip imports check
  }

  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      block.code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: TS.Node): void => {
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const line =
          block.lineStart + sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const exportName = calleeExport(node.expression, registry, scope);
        const note = exportName ? registry.deprecated.get(exportName) : undefined;
        if (exportName && note !== undefined) {
          push(exportName, note, line);
        } else if (!exportName && ts.isPropertyAccessExpression(node.expression)) {
          const member = node.expression.name.text;
          const dep = registry.deprecatedMembers.get(member);
          const receiver = node.expression.expression;
          const isNamespace = ts.isIdentifier(receiver) && scope.namespaces.has(receiver.text);
          const owner =
            dep && !isNamespace && !JS_BUILTIN_METHODS.has(member)
              ? expressionType(receiver, registry, scope, spec)
              : undefined;
          if (dep && owner && dep.parents.has(owner)) push(member, dep.note, line, owner);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  } catch {
    // parse failure — skip call checks
  }
}

/** Wording a section uses to own up to a deprecation. */
const DEPRECATION_NOTE: RegExp = /deprecat|no longer (?:maintained|supported)|\blegacy\b/i;

function wordRe(word: string): RegExp {
  return new RegExp(`(?<![\\w$])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`);
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
 * Variables assigned from a call to a known package export, with the spec type
 * they hold. `const simnet = await initSimnet()` holds the export's return
 * type (the class itself for `new`). A destructured element holds the closed
 * spec type of its own property or tuple position, never the return type;
 * `undefined` when there is none, which also shadows an earlier binding.
 */
function extractPackageDerivedNames(
  code: string,
  registry: ExportRegistry,
  spec?: ApiSpec,
  namespaces: ReadonlySet<string> = new Set(),
): Map<string, string | undefined> {
  const names = new Map<string, string | undefined>();

  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const walk = (node: TS.Node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        let expr: TS.Expression = node.initializer;
        if (ts.isAwaitExpression(expr)) expr = expr.expression;
        // `f(...)`, `new F(...)`, or the same through a namespace alias: `z.string()`.
        const fn = ts.isCallExpression(expr) || ts.isNewExpression(expr) ? expr.expression : null;
        const calleeName = !fn
          ? undefined
          : ts.isIdentifier(fn)
            ? fn.text
            : ts.isPropertyAccessExpression(fn) &&
                ts.isIdentifier(fn.expression) &&
                namespaces.has(fn.expression.text)
              ? fn.name.text
              : undefined;
        const callee =
          calleeName && registry.all.has(calleeName)
            ? { exportName: calleeName, isNew: ts.isNewExpression(expr) }
            : undefined;
        const { bound, unbound } = declaredBindings(node.name);
        const destructured = bound.some((b) => b.key !== undefined) || unbound.length > 0;
        if (callee || destructured) {
          for (const name of unbound) names.set(name, undefined);
          for (const { name, key } of bound) {
            if (key === undefined) {
              if (callee) names.set(name, registry.callableReturnTypes.get(callee.exportName));
            } else {
              names.set(
                name,
                callee && spec ? destructuredTypeName(spec, registry, key, callee) : undefined,
              );
            }
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
        names.set(match[1], registry.callableReturnTypes.get(match[2]));
      }
    }
  }

  return names;
}
