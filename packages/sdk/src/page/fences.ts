import type * as TS from 'typescript';
import type { ApiSpec } from '../analysis/api-spec';
import { namedImportElements } from '../markdown/ast-extractor';
import type { MarkdownCodeBlock } from '../markdown/types';
import { ts } from '../ts-module';
import { isBuiltInIdentifier } from '../utils/builtin-detection';
import { collectHeadings, nearestHeading } from './locators';
import { memberReturnType } from './spec-ref';

export type FenceCall = {
  objectName: string;
  methodName: string;
  /** 0-indexed line within the code block value */
  line: number;
  /** 0-indexed column on that line */
  col: number;
  text: string;
};

/** `const x = new Foo(...)` / `const x = await new Foo(...)` in a fence. */
export function extractInstanceBindings(code: string): Map<string, string> {
  const names = new Map<string, string>();
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const walk = (node: TS.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        let expr = node.initializer;
        if (ts.isAwaitExpression(expr)) expr = expr.expression;
        if (ts.isNewExpression(expr) && expr.expression && ts.isIdentifier(expr.expression)) {
          names.set(node.name.text, expr.expression.text);
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
  } catch {
    // parse failure
  }
  return names;
}

export type FenceImport = {
  /** Local binding (`b` in `import { a as b }`) */
  name: string;
  /** Name the module exports (`a`); `default` / `*` for those import kinds */
  imported: string;
  from: string;
  /** 0-indexed line / column of `text` within the code block value */
  line: number;
  col: number;
  text: string;
  kind: 'named' | 'default' | 'namespace';
  /** `a: b` written for `a as b`: `pair` normalised, `text` as written, starting where `imported` does */
  invalidPair?: { pair: string; text: string };
};

/**
 * Call expressions `obj.method(...)` with source text, for fence locators.
 */
export function extractFenceCalls(code: string): FenceCall[] {
  const calls: FenceCall[] = [];
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: TS.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const methodName = node.expression.name.text;
        const objectExpr = node.expression.expression;
        let objectName: string | undefined;
        if (ts.isIdentifier(objectExpr)) objectName = objectExpr.text;
        if (objectName && !isBuiltInIdentifier(objectName)) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          calls.push({
            objectName,
            methodName,
            line: pos.line,
            col: pos.character,
            text: node.getText(sourceFile),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  } catch {
    // parse failure — no calls
  }
  return calls;
}

/**
 * `const x = new Foo(...)` plus `const x = [await] Foo(...)` when `Foo` is a
 * known export. With `spec`, `const x = obj.method(...)` binds `x` to the
 * spec return type of that method (e.g. `client.joinRoom()` → `Room`).
 * Later fences reuse earlier bindings.
 */
export function extractExportBindings(
  code: string,
  exportNames?: ReadonlySet<string>,
  spec?: ApiSpec,
  prior?: ReadonlyMap<string, string>,
  aliases?: ReadonlyMap<string, string>,
): Map<string, string> {
  const names = new Map(prior ?? []);
  for (const [k, v] of extractInstanceBindings(code)) names.set(k, v);
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const bindFromInit = (name: string, initializer: TS.Expression): void => {
      let expr = initializer;
      if (ts.isAwaitExpression(expr)) expr = expr.expression;
      if (ts.isCallExpression(expr) || ts.isNewExpression(expr)) {
        if (ts.isIdentifier(expr.expression)) {
          const callee = aliases?.get(expr.expression.text) ?? expr.expression.text;
          if (exportNames?.has(callee)) {
            names.set(name, callee);
            return;
          }
        }
        if (
          spec &&
          ts.isCallExpression(expr) &&
          ts.isPropertyAccessExpression(expr.expression) &&
          ts.isIdentifier(expr.expression.expression)
        ) {
          const obj = expr.expression.expression.text;
          const member = expr.expression.name.text;
          const objType = names.get(obj);
          if (!objType) return;
          const ret = memberReturnType(spec, objType, member);
          if (ret) names.set(name, ret);
        }
      }
    };
    const walk = (node: TS.Node): void => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (ts.isIdentifier(node.name)) {
          bindFromInit(node.name.text, node.initializer);
        } else if (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name)) {
          for (const el of node.name.elements) {
            if (ts.isBindingElement(el) && ts.isIdentifier(el.name)) {
              bindFromInit(el.name.text, node.initializer);
            }
          }
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
  } catch {
    // parse failure
  }
  return names;
}

/** `obj.member` / `obj.member(...)` in a fence. */
export function extractFenceMembers(code: string): Array<{
  objectName: string;
  memberName: string;
  line: number;
  text: string;
}> {
  const mentions: Array<{ objectName: string; memberName: string; line: number; text: string }> =
    [];
  const seen = new Set<string>();
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: TS.Node): void => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const objectName = node.expression.text;
        if (!isBuiltInIdentifier(objectName)) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const key = `${pos.line}:${objectName}.${node.name.text}`;
          if (!seen.has(key)) {
            seen.add(key);
            mentions.push({
              objectName,
              memberName: node.name.text,
              line: pos.line,
              text: node.getText(sourceFile),
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  } catch {
    // parse failure
  }
  return mentions;
}

export type CallSiteArg = {
  keys?: string[];
  hasSpread?: boolean;
};

/** Call, `new`, or JSX site in a fence — value args only, never type args. */
export type CallSite = {
  kind: 'call' | 'new' | 'jsx';
  name: string;
  objectName?: string;
  argCount: number;
  hasSpreadArg: boolean;
  args: CallSiteArg[];
  jsxKeys: string[];
  hasJsxSpread: boolean;
  hasChildren: boolean;
  /** Argument list is only a comment, `...`, or a block-comment placeholder. */
  elided: boolean;
  /** The call (or a chain hanging off it) is a whole expression statement: `z.map();`. */
  bareStatement: boolean;
  /** 0-indexed line / column of `text` within the code block value */
  line: number;
  col: number;
  text: string;
};

const TYPED_PARAM: RegExp = /^\s*(?:\.\.\.)?[A-Za-z_$][\w$]*\s*\??\s*:/;

/** Split on top-level commas, respecting `<> [] {} ()` and strings. */
export function splitTopLevel(src: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let angle = 0;
  let square = 0;
  let curly = 0;
  let paren = 0;
  let quote: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '<') angle++;
    else if (ch === '>' && angle > 0) angle--;
    else if (ch === '[') square++;
    else if (ch === ']' && square > 0) square--;
    else if (ch === '{') curly++;
    else if (ch === '}' && curly > 0) curly--;
    else if (ch === '(') paren++;
    else if (ch === ')' && paren > 0) paren--;
    else if (ch === ',' && angle === 0 && square === 0 && curly === 0 && paren === 0) {
      const part = src.slice(start, i).trim();
      if (part) parts.push(part);
      start = i + 1;
    }
  }
  const last = src.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}

function parenInner(node: TS.CallExpression | TS.NewExpression, sourceFile: TS.SourceFile): string {
  const text = node.getText(sourceFile);
  const open = text.indexOf('(');
  const close = text.lastIndexOf(')');
  if (open === -1 || close <= open) return '';
  return text.slice(open + 1, close);
}

/** Bare `name<...>(a: T, b?: U): R` printed in a fence — a declaration, not a call. */
function isBareSignature(node: TS.CallExpression, sourceFile: TS.SourceFile): boolean {
  if (/^\s*:/.test(sourceFile.text.slice(node.getEnd()))) return true;
  const parts = splitTopLevel(parenInner(node, sourceFile));
  return parts.length > 0 && parts.every((p) => TYPED_PARAM.test(p));
}

/** `f();`, `f().g();`, `(f())!.g;`: nothing reads the value. `await f();` runs it. */
function isBareStatement(node: TS.CallExpression): boolean {
  let cur: TS.Node = node;
  for (;;) {
    const parent = cur.parent;
    if (!parent) return false;
    if (ts.isExpressionStatement(parent)) return true;
    const chained =
      ts.isParenthesizedExpression(parent) ||
      ts.isNonNullExpression(parent) ||
      ((ts.isPropertyAccessExpression(parent) ||
        ts.isElementAccessExpression(parent) ||
        ts.isCallExpression(parent)) &&
        parent.expression === cur);
    if (!chained) return false;
    cur = parent;
  }
}

function isElidedArgList(
  node: TS.CallExpression | TS.NewExpression,
  sourceFile: TS.SourceFile,
): boolean {
  const inner = parenInner(node, sourceFile);
  const stripped = inner
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .trim();
  if (stripped === '...' || stripped === '…') return true;
  return stripped === '' && /\/\*|\/\//.test(inner);
}

function objectLiteralKeys(
  expr: TS.Expression,
): { keys: string[]; hasSpread: boolean } | undefined {
  let inner: TS.Expression = expr;
  if (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  if (ts.isAsExpression(inner)) inner = inner.expression;
  if (!ts.isObjectLiteralExpression(inner)) return undefined;
  const keys: string[] = [];
  let hasSpread = false;
  for (const prop of inner.properties) {
    if (ts.isSpreadAssignment(prop)) {
      hasSpread = true;
      continue;
    }
    const n =
      ts.isPropertyAssignment(prop) ||
      ts.isShorthandPropertyAssignment(prop) ||
      ts.isMethodDeclaration(prop)
        ? prop.name
        : undefined;
    if (!n) continue;
    if (ts.isIdentifier(n)) keys.push(n.text);
    else if (ts.isStringLiteral(n)) keys.push(n.text);
  }
  return { keys, hasSpread };
}

function valueArgs(node: TS.CallExpression | TS.NewExpression): {
  argCount: number;
  hasSpreadArg: boolean;
  args: CallSiteArg[];
} {
  const list = node.arguments ?? [];
  let hasSpreadArg = false;
  const args: CallSiteArg[] = [];
  for (const a of list) {
    if (ts.isSpreadElement(a)) {
      hasSpreadArg = true;
      args.push({ hasSpread: true });
      continue;
    }
    const obj = objectLiteralKeys(a);
    args.push(obj ? { keys: obj.keys, hasSpread: obj.hasSpread } : {});
  }
  return { argCount: list.length, hasSpreadArg, args };
}

function jsxTag(tag: TS.JsxTagNameExpression): { name: string; objectName?: string } | null {
  if (ts.isIdentifier(tag)) return { name: tag.text };
  if (ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression)) {
    return { name: tag.name.text, objectName: tag.expression.text };
  }
  return null;
}

function jsxAttrs(attrs: TS.JsxAttributes): { keys: string[]; hasSpread: boolean } {
  const keys: string[] = [];
  let hasSpread = false;
  for (const attr of attrs.properties) {
    if (ts.isJsxSpreadAttribute(attr)) {
      hasSpread = true;
      continue;
    }
    if (ts.isJsxAttribute(attr)) {
      const n = attr.name;
      if (ts.isIdentifier(n)) keys.push(n.text);
    }
  }
  return { keys, hasSpread };
}

function jsxHasChildren(node: TS.JsxElement): boolean {
  return node.children.some((ch) => {
    if (ts.isJsxText(ch)) return ch.text.trim().length > 0;
    return true;
  });
}

/**
 * Call / `new` / JSX sites. `argCount` is value arguments; type arguments
 * (`foo<T, U>()`) are not counted.
 */
export function extractCallSites(code: string): CallSite[] {
  const sites: CallSite[] = [];
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: TS.Node): void => {
      if (ts.isCallExpression(node)) {
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { argCount, hasSpreadArg, args } = valueArgs(node);
        const expr = node.expression;
        if (ts.isIdentifier(expr)) {
          if (isBareSignature(node, sourceFile)) return;
          sites.push({
            kind: 'call',
            name: expr.text,
            argCount,
            hasSpreadArg,
            args,
            jsxKeys: [],
            hasJsxSpread: false,
            hasChildren: false,
            elided: isElidedArgList(node, sourceFile),
            bareStatement: isBareStatement(node),
            line: pos.line,
            col: pos.character,
            text: node.getText(sourceFile),
          });
        } else if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
          sites.push({
            kind: 'call',
            name: expr.name.text,
            objectName: expr.expression.text,
            argCount,
            hasSpreadArg,
            args,
            jsxKeys: [],
            hasJsxSpread: false,
            hasChildren: false,
            elided: isElidedArgList(node, sourceFile),
            bareStatement: isBareStatement(node),
            line: pos.line,
            col: pos.character,
            text: node.getText(sourceFile),
          });
        }
      }
      if (ts.isNewExpression(node) && node.expression && ts.isIdentifier(node.expression)) {
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { argCount, hasSpreadArg, args } = valueArgs(node);
        sites.push({
          kind: 'new',
          name: node.expression.text,
          argCount,
          hasSpreadArg,
          args,
          jsxKeys: [],
          hasJsxSpread: false,
          hasChildren: false,
          elided: isElidedArgList(node, sourceFile),
          bareStatement: false,
          line: pos.line,
          col: pos.character,
          text: node.getText(sourceFile),
        });
      }
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
        const open = ts.isJsxElement(node) ? node.openingElement : node;
        const tag = jsxTag(open.tagName);
        if (tag) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const { keys, hasSpread } = jsxAttrs(open.attributes);
          sites.push({
            kind: 'jsx',
            name: tag.name,
            objectName: tag.objectName,
            argCount: 0,
            hasSpreadArg: false,
            args: [],
            jsxKeys: keys,
            hasJsxSpread: hasSpread,
            hasChildren: ts.isJsxElement(node) ? jsxHasChildren(node) : false,
            elided: false,
            bareStatement: false,
            line: pos.line,
            col: pos.character,
            text: open.getText(sourceFile),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  } catch {
    // parse failure
  }
  return sites;
}

export function extractFenceImports(code: string): FenceImport[] {
  const imports: FenceImport[] = [];
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    ts.forEachChild(sourceFile, (node) => {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return;
      const from = node.moduleSpecifier.text;
      const clause = node.importClause;
      if (!clause) return;
      const posOf = (n: TS.Node): { line: number; col: number } => {
        const pos = sourceFile.getLineAndCharacterOfPosition(n.getStart());
        return { line: pos.line, col: pos.character };
      };
      if (clause.name) {
        imports.push({
          name: clause.name.text,
          imported: 'default',
          from,
          ...posOf(clause.name),
          text: clause.name.getText(sourceFile),
          kind: 'default',
        });
      }
      const named = clause.namedBindings;
      if (named && ts.isNamespaceImport(named)) {
        imports.push({
          name: named.name.text,
          imported: '*',
          from,
          ...posOf(named.name),
          text: named.name.getText(sourceFile),
          kind: 'namespace',
        });
      }
      if (named && ts.isNamedImports(named)) {
        for (const el of namedImportElements(named, sourceFile)) {
          // The claim is about the exported name, so that is the span.
          imports.push({
            name: el.local.text,
            imported: el.source.text,
            from,
            ...posOf(el.source),
            text: el.source.getText(sourceFile),
            kind: 'named',
            ...(el.invalid ? { invalidPair: el.invalid } : {}),
          });
        }
      }
    });
  } catch {
    // parse failure
  }
  return imports;
}

export function blockContaining(
  blocks: MarkdownCodeBlock[],
  line: number,
): MarkdownCodeBlock | undefined {
  return blocks.find((b) => line >= b.lineStart && line <= b.lineEnd);
}

export function isPackageSpecifier(
  from: string,
  packageName: string,
  importSpecifier?: string,
): boolean {
  return from === (importSpecifier ?? packageName);
}

/** Heading or fence comment that presents another library's "before" code. */
export function isMigrationFence(
  markdown: string | undefined,
  blockLineStart: number,
  code: string,
): boolean {
  if (/^\s*(\/\/|\/\*)\s*(change this|before|previous)\b/im.test(code)) return true;
  if (!markdown) return false;
  const heading = nearestHeading(collectHeadings(markdown), blockLineStart)?.text ?? '';
  return /^(change this|before|previous)(\s+api)?$/i.test(heading);
}

export function fenceImportKind(
  code: string,
  packageName: string,
  importSpecifier?: string,
): 'ours' | 'foreign' | 'none' {
  let ours = false;
  let foreign = false;
  for (const imp of extractFenceImports(code)) {
    if (isPackageSpecifier(imp.from, packageName, importSpecifier)) ours = true;
    else foreign = true;
  }
  if (ours) return 'ours';
  if (foreign) return 'foreign';
  return 'none';
}

/**
 * `import * as ns from '<pkg>'`, plus a short ident used as `x.<export>(`
 * for two or more distinct package exports when the page never shows the import.
 * `aliases` maps a renamed local to its export (`import { a as b }` → b → a).
 */
export function collectPackageNamespaces(
  codes: readonly string[],
  exportNames: ReadonlySet<string>,
  packageName: string,
  importSpecifier?: string,
): { namespaces: Set<string>; namedImports: Set<string>; aliases: Map<string, string> } {
  const namespaces = new Set<string>();
  const namedImports = new Set<string>();
  const aliases = new Map<string, string>();
  for (const code of codes) {
    for (const imp of extractFenceImports(code)) {
      if (!isPackageSpecifier(imp.from, packageName, importSpecifier)) continue;
      if (imp.kind === 'namespace') namespaces.add(imp.name);
      else namedImports.add(imp.name);
      if (imp.kind === 'named' && imp.imported !== imp.name && imp.imported !== 'default') {
        aliases.set(imp.name, imp.imported);
      }
    }
  }
  if (namespaces.size === 0) {
    const hits = new Map<string, Set<string>>();
    for (const code of codes) {
      for (const call of extractFenceCalls(code)) {
        if (!exportNames.has(call.methodName)) continue;
        if (exportNames.has(call.objectName)) continue;
        if (call.objectName.length > 3) continue;
        let set = hits.get(call.objectName);
        if (!set) {
          set = new Set();
          hits.set(call.objectName, set);
        }
        set.add(call.methodName);
      }
    }
    for (const [ident, names] of hits) if (names.size >= 2) namespaces.add(ident);
  }
  return { namespaces, namedImports, aliases };
}
