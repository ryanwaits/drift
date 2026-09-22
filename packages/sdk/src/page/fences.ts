import type * as TS from 'typescript';
import type { ApiSpec } from '../analysis/api-spec';
import type { ExportRegistry } from '../analysis/drift/types';
import { namedImportElements } from '../markdown/ast-extractor';
import type { MarkdownCodeBlock } from '../markdown/types';
import { ts } from '../ts-module';
import { isBuiltInIdentifier } from '../utils/builtin-detection';
import { collectHeadings, FENCE, HEADING, nearestHeading } from './locators';
import { destructuredTypeName, memberReturnType } from './spec-ref';

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

/** Names the fence itself declares: variables (destructured too), functions, classes, parameters. */
export function extractLocalNames(code: string): Set<string> {
  const names = new Set<string>();
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const bind = (name: TS.BindingName): void => {
      if (ts.isIdentifier(name)) names.add(name.text);
      else for (const el of name.elements) if (ts.isBindingElement(el)) bind(el.name);
    };
    const walk = (node: TS.Node): void => {
      if (ts.isVariableDeclaration(node) || ts.isParameter(node)) bind(node.name);
      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
        names.add(node.name.text);
      }
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
  } catch {
    // parse failure
  }
  return names;
}

/**
 * Per fence, the names the page has made its own by then: a top-level
 * `const|let|var|function|class` (destructured too) in an EARLIER fence. Such a
 * name is the reader's object in later fences, never the export it shares a
 * name with, whatever its initializer (`const useStore = create(...)`). A fence
 * that imports the name from the package rebinds it to the export, from that
 * fence on. Declarations nested in a function body are not page scope; a
 * printed signature (`function f(a: T): R` with no body, `declare ...`) is the
 * export's own declaration, not a shadow.
 */
export function pageLocalNames(
  codes: readonly string[],
  packageName: string,
): Array<ReadonlySet<string>> {
  const declared = new Set<string>();
  return codes.map((code) => {
    for (const imp of extractFenceImports(code)) {
      if (isPackageModule(imp.from, packageName)) declared.delete(imp.name);
    }
    const visible = new Set(declared);
    for (const name of topLevelNames(code)) declared.add(name);
    return visible;
  });
}

function topLevelNames(code: string): Set<string> {
  const names = new Set<string>();
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const bind = (name: TS.BindingName): void => {
      if (ts.isIdentifier(name)) names.add(name.text);
      else for (const el of name.elements) if (ts.isBindingElement(el)) bind(el.name);
    };
    for (const statement of sourceFile.statements) {
      const ambient =
        ts.canHaveModifiers(statement) &&
        ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword);
      if (ambient) continue;
      if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) bind(decl.name);
      } else if (ts.isFunctionDeclaration(statement)) {
        if (statement.name && statement.body) names.add(statement.name.text);
      } else if (ts.isClassDeclaration(statement) && statement.name) {
        names.add(statement.name.text);
      }
    }
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

/** A name a variable declaration introduces, and the part of the initializer it takes. */
export type DeclaredBinding = {
  name: string;
  /** Property name, or tuple position: absent when the name takes the whole value. */
  key?: string | number;
};

/**
 * `x` takes the whole value; `{ a }`, `{ a: b }`, `{ a = 1 }` take property
 * `a`; `[a, b]` take positions 0 and 1. Rest elements, nested patterns and
 * computed keys bind nothing, reported as `unbound`.
 */
export function declaredBindings(name: TS.BindingName): {
  bound: DeclaredBinding[];
  unbound: string[];
} {
  if (ts.isIdentifier(name)) return { bound: [{ name: name.text }], unbound: [] };
  const bound: DeclaredBinding[] = [];
  const unbound: string[] = [];
  const drop = (n: TS.BindingName): void => {
    if (ts.isIdentifier(n)) unbound.push(n.text);
    else for (const el of n.elements) if (ts.isBindingElement(el)) drop(el.name);
  };
  name.elements.forEach((el, index) => {
    if (!ts.isBindingElement(el)) return;
    const prop = el.propertyName ?? el.name;
    if (el.dotDotDotToken || !ts.isIdentifier(el.name)) drop(el.name);
    else if (ts.isArrayBindingPattern(name)) bound.push({ name: el.name.text, key: index });
    else if (ts.isIdentifier(prop) || ts.isStringLiteral(prop)) {
      bound.push({ name: el.name.text, key: prop.text });
    } else drop(el.name);
  });
  return { bound, unbound };
}

/**
 * `const x = new Foo(...)` plus `const x = [await] Foo(...)` when `Foo` is a
 * known export. With `spec`, `const x = obj.method(...)` binds `x` to the
 * spec return type of that method (e.g. `client.joinRoom()` → `Room`).
 * A destructured element is bound to the closed spec type of its own property
 * or tuple position (needs `spec` and `registry`), never to the return type;
 * otherwise it is unbound, and shadows an earlier binding of that name.
 * `ns.create()` through a namespace alias binds like `create()`. A callee in
 * `ambiguous` or `shadowed` binds nothing. Later fences reuse earlier bindings.
 */
export function extractExportBindings(
  code: string,
  scope: {
    exportNames?: ReadonlySet<string>;
    spec?: ApiSpec;
    prior?: ReadonlyMap<string, string>;
    /** Renamed / default imports: local → export */
    aliases?: ReadonlyMap<string, string>;
    registry?: ExportRegistry;
    /** `import * as ns` aliases: `ns.create()` is the export `create` */
    namespaces?: ReadonlySet<string>;
    /** Exports that bind nothing here: another entry of the package types them differently */
    ambiguous?: ReadonlySet<string>;
    /** Names the page declared in an earlier fence: a bare callee among them is no export */
    shadowed?: ReadonlySet<string>;
  } = {},
): Map<string, string> {
  const { exportNames, spec, prior, aliases, registry, namespaces, ambiguous, shadowed } = scope;
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
    const calleeOf = (
      initializer: TS.Expression,
    ): { exportName: string; member?: string; isNew?: boolean } | undefined => {
      let expr = initializer;
      if (ts.isAwaitExpression(expr)) expr = expr.expression;
      if (!ts.isCallExpression(expr) && !ts.isNewExpression(expr)) return undefined;
      if (ts.isIdentifier(expr.expression)) {
        if (shadowed?.has(expr.expression.text)) return undefined;
        const callee = aliases?.get(expr.expression.text) ?? expr.expression.text;
        if (!exportNames?.has(callee)) return undefined;
        return { exportName: callee, isNew: ts.isNewExpression(expr) };
      }
      if (
        ts.isPropertyAccessExpression(expr.expression) &&
        ts.isIdentifier(expr.expression.expression) &&
        namespaces?.has(expr.expression.expression.text)
      ) {
        const callee = expr.expression.name.text;
        if (!exportNames?.has(callee)) return undefined;
        return { exportName: callee, isNew: ts.isNewExpression(expr) };
      }
      if (
        ts.isCallExpression(expr) &&
        ts.isPropertyAccessExpression(expr.expression) &&
        ts.isIdentifier(expr.expression.expression)
      ) {
        const bound = names.get(expr.expression.expression.text);
        if (!bound) return undefined;
        const objType = registry?.callableReturnTypes.get(bound) ?? bound;
        return { exportName: objType, member: expr.expression.name.text };
      }
      return undefined;
    };
    const walk = (node: TS.Node): void => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const found = calleeOf(node.initializer);
        const unsure = found !== undefined && !found.member && ambiguous?.has(found.exportName);
        const callee = unsure ? undefined : found;
        const { bound, unbound } = declaredBindings(node.name);
        for (const name of unbound) names.delete(name);
        for (const { name, key } of bound) {
          if (unsure) {
            names.delete(name);
          } else if (key !== undefined) {
            const type =
              callee && spec && registry
                ? destructuredTypeName(spec, registry, key, callee)
                : undefined;
            if (type) names.set(name, type);
            else names.delete(name);
          } else if (callee && !callee.member) {
            names.set(name, callee.exportName);
          } else if (callee?.member && spec) {
            const ret = memberReturnType(spec, callee.exportName, callee.member);
            if (ret) names.set(name, ret);
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

export type FenceMember = ReturnType<typeof extractFenceMembers>[number];

const COMMENT_MEMBER: RegExp = /(?<![\w$.])([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g;

/**
 * `obj.member` written inside a line (`//`) or block comment of a fence. Comments
 * are trivia, not AST nodes, so `extractFenceMembers` never sees them; a page
 * that shows `// server.port → 1999` still teaches `port`. Same shape as code
 * mentions; the caller applies the same binding / section rules.
 */
export function extractFenceCommentMembers(code: string): FenceMember[] {
  const mentions: FenceMember[] = [];
  const seen = new Set<string>();
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const ranges = new Map<number, TS.CommentRange>();
    const collect = (list: TS.CommentRange[] | undefined): void => {
      for (const r of list ?? []) ranges.set(r.pos, r);
    };
    const walk = (node: TS.Node): void => {
      collect(ts.getLeadingCommentRanges(code, node.pos));
      collect(ts.getTrailingCommentRanges(code, node.end));
      for (const child of node.getChildren(sourceFile)) walk(child);
    };
    walk(sourceFile);
    for (const range of ranges.values()) {
      const body = code.slice(range.pos, range.end);
      for (const m of body.matchAll(COMMENT_MEMBER)) {
        const [text, objectName, memberName] = m;
        if (isBuiltInIdentifier(objectName)) continue;
        const pos = sourceFile.getLineAndCharacterOfPosition(range.pos + (m.index ?? 0));
        const key = `${pos.line}:${objectName}.${memberName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        mentions.push({ objectName, memberName, line: pos.line, text });
      }
    }
  } catch {
    // parse failure
  }
  return mentions;
}

/** A literal written in a fence: `"a"`, `` `a` `` (no substitutions), `5`, `-5`, `true`. */
export type LiteralValue = {
  type: 'string' | 'number' | 'boolean';
  /** As written, quotes included */
  text: string;
  /** 0-indexed line / column of `text` within the fence code */
  line: number;
  col: number;
};

export type CallSiteArg = {
  keys?: string[];
  hasSpread?: boolean;
  /** Object literal whose body carries an elision marker (`// ...`) or a spread: a partial sample */
  elided?: boolean;
  /** The argument is a literal */
  literal?: LiteralValue;
  /** Literal property values of an object-literal argument */
  props?: Array<{ key: string; literal: LiteralValue }>;
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
  /** JSX attributes whose value is a literal: `count="5"`, `count={5}` */
  jsxLiterals?: Array<{ key: string; literal: LiteralValue }>;
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

const COMMENT_ELLIPSIS: RegExp = /^(?:\/\/|\/\*)\s*(?:\.\.\.|…)/;

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

/**
 * An object literal whose body says "more here": a comment that is only
 * `...` / `…` (trailing words allowed: `// ... other options`) before any
 * property or before the closing brace, or a bare `…` line. Spreads are
 * reported by `objectLiteralKeys` itself.
 */
function hasElisionMarker(obj: TS.ObjectLiteralExpression, sourceFile: TS.SourceFile): boolean {
  const text = sourceFile.text;
  const positions = [...obj.properties.map((p) => p.getFullStart()), obj.properties.end];
  for (const pos of positions) {
    for (const range of ts.getLeadingCommentRanges(text, pos) ?? []) {
      if (COMMENT_ELLIPSIS.test(text.slice(range.pos, range.end))) return true;
    }
  }
  return obj
    .getText(sourceFile)
    .split('\n')
    .some((line) => /^\s*…\s*$/.test(line));
}

function literalValue(expr: TS.Expression, sourceFile: TS.SourceFile): LiteralValue | undefined {
  let inner: TS.Expression = expr;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  const negative =
    ts.isPrefixUnaryExpression(inner) &&
    (inner.operator === ts.SyntaxKind.MinusToken || inner.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(inner.operand);
  const type =
    ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)
      ? 'string'
      : ts.isNumericLiteral(inner) || negative
        ? 'number'
        : inner.kind === ts.SyntaxKind.TrueKeyword || inner.kind === ts.SyntaxKind.FalseKeyword
          ? 'boolean'
          : undefined;
  if (!type) return undefined;
  const pos = sourceFile.getLineAndCharacterOfPosition(inner.getStart(sourceFile));
  return { type, text: inner.getText(sourceFile), line: pos.line, col: pos.character };
}

function objectLiteralKeys(
  expr: TS.Expression,
  sourceFile: TS.SourceFile,
):
  | {
      keys: string[];
      hasSpread: boolean;
      elided: boolean;
      props: NonNullable<CallSiteArg['props']>;
    }
  | undefined {
  let inner: TS.Expression = expr;
  if (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  if (ts.isAsExpression(inner)) inner = inner.expression;
  if (!ts.isObjectLiteralExpression(inner)) return undefined;
  const keys: string[] = [];
  const props: NonNullable<CallSiteArg['props']> = [];
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
    if (!n || (!ts.isIdentifier(n) && !ts.isStringLiteral(n))) continue;
    keys.push(n.text);
    const literal = ts.isPropertyAssignment(prop)
      ? literalValue(prop.initializer, sourceFile)
      : undefined;
    if (literal) props.push({ key: n.text, literal });
  }
  return { keys, hasSpread, elided: hasSpread || hasElisionMarker(inner, sourceFile), props };
}

function valueArgs(
  node: TS.CallExpression | TS.NewExpression,
  sourceFile: TS.SourceFile,
): {
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
    const obj = objectLiteralKeys(a, sourceFile);
    const literal = obj ? undefined : literalValue(a, sourceFile);
    args.push(
      obj
        ? {
            keys: obj.keys,
            hasSpread: obj.hasSpread,
            ...(obj.elided ? { elided: true } : {}),
            ...(obj.props.length ? { props: obj.props } : {}),
          }
        : literal
          ? { literal }
          : {},
    );
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

function jsxAttrs(
  attrs: TS.JsxAttributes,
  sourceFile: TS.SourceFile,
): { keys: string[]; hasSpread: boolean; literals: NonNullable<CallSite['jsxLiterals']> } {
  const keys: string[] = [];
  const literals: NonNullable<CallSite['jsxLiterals']> = [];
  let hasSpread = false;
  for (const attr of attrs.properties) {
    if (ts.isJsxSpreadAttribute(attr)) {
      hasSpread = true;
      continue;
    }
    if (ts.isJsxAttribute(attr)) {
      const n = attr.name;
      if (!ts.isIdentifier(n)) continue;
      keys.push(n.text);
      const init = attr.initializer;
      const value =
        init && ts.isJsxExpression(init)
          ? init.expression
          : init && ts.isStringLiteral(init)
            ? init
            : undefined;
      const literal = value ? literalValue(value, sourceFile) : undefined;
      if (literal) literals.push({ key: n.text, literal });
    }
  }
  return { keys, hasSpread, literals };
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
        const { argCount, hasSpreadArg, args } = valueArgs(node, sourceFile);
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
        const { argCount, hasSpreadArg, args } = valueArgs(node, sourceFile);
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
          const { keys, hasSpread, literals } = jsxAttrs(open.attributes, sourceFile);
          sites.push({
            kind: 'jsx',
            name: tag.name,
            objectName: tag.objectName,
            argCount: 0,
            hasSpreadArg: false,
            args: [],
            jsxKeys: keys,
            ...(literals.length > 0 ? { jsxLiterals: literals } : {}),
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

/** The package root or any of its subpath entries (`zod`, `zod/mini`). */
export function isPackageModule(from: string, packageName: string): boolean {
  return from === packageName || from.startsWith(`${packageName}/`);
}

const DIFF_LINE: RegExp = /^[+-](?: |$)/;

/** Offsets of template literals and block comments: a `- ` bullet inside a prompt string is text. */
function literalRanges(code: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const walk = (node: TS.Node): void => {
      if (ts.isTemplateLiteral(node) || ts.isStringLiteral(node)) {
        ranges.push([node.getStart(sourceFile), node.end]);
        return;
      }
      for (const r of ts.getLeadingCommentRanges(code, node.getFullStart()) ?? []) {
        if (r.kind === ts.SyntaxKind.MultiLineCommentTrivia) ranges.push([r.pos, r.end]);
      }
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
  } catch {
    // parse failure: no ranges
  }
  return ranges;
}

/**
 * A fence written as a diff: lines prefixed `+` / `-` at column 0 (a space
 * after the marker; `-1` is a number; a `- ` bullet inside a template
 * literal is text). `code` is the "after" view with the same lines and
 * columns: removed lines blanked, markers replaced by a space. Not a diff:
 * `code` unchanged.
 */
export function diffView(code: string): { diff: boolean; code: string } {
  const lines = code.split('\n');
  if (!lines.some((l) => DIFF_LINE.test(l))) return { diff: false, code };
  const ranges = literalRanges(code);
  let offset = 0;
  const marker: boolean[] = lines.map((l) => {
    const at = offset;
    offset += l.length + 1;
    return DIFF_LINE.test(l) && !ranges.some(([a, b]) => at > a && at < b);
  });
  if (!marker.some(Boolean)) return { diff: false, code };
  const after = lines.map((l, i) => (marker[i] ? (l[0] === '-' ? '' : ` ${l.slice(1)}`) : l));
  return { diff: true, code: after.join('\n') };
}

/**
 * Prose that negates an API rather than teaching it: `has been removed`,
 * `no longer available`, `will no longer work`, `Removed`, `renamed from`.
 * A reference under such wording is history, not a claim about the spec.
 */
const NEGATED_API: RegExp =
  /\b(?:removed|removal|remove[sd]?\b|no longer|dropped|deleted|replaced|renamed|superseded|deprecated)\b/i;

export function isNegatedApiText(text: string): boolean {
  return NEGATED_API.test(text);
}

/** The paragraph right above the fence at `blockLineStart` (1-indexed), if any. */
function introText(lines: readonly string[], blockLineStart: number): string {
  let i = blockLineStart - 2;
  while (i >= 0 && !lines[i].trim()) i--;
  const end = i;
  while (i >= 0 && lines[i].trim() && !HEADING.test(lines[i]) && !FENCE.test(lines[i])) i--;
  return lines.slice(i + 1, end + 1).join('\n');
}

/**
 * The fence sits under a heading, or right after a sentence, that negates
 * the API it shows (`Removed`, `has been removed`, `will no longer work`):
 * history, not a claim about the spec.
 */
export function isNegatedFence(markdown: string | undefined, blockLineStart: number): boolean {
  if (!markdown) return false;
  const heading = nearestHeading(collectHeadings(markdown), blockLineStart)?.text ?? '';
  if (isNegatedApiText(heading)) return true;
  return isNegatedApiText(introText(markdown.split('\n'), blockLineStart));
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

/** What the page's imports bind to one entry of the package. */
export type PackageNamespaces = {
  /** Namespace aliases: imported (`import * as ns`) or inferred from `x.<export>(` use */
  namespaces: Set<string>;
  /** The imported aliases only: the ones a `ns.member` claim may stand on */
  importedNamespaces: Set<string>;
  namedImports: Set<string>;
  aliases: Map<string, string>;
};

/**
 * `import * as ns from '<pkg>'`, plus a short ident used as `x.<export>(`
 * for two or more distinct package exports when the page never shows the import.
 * A name any fence imports from another package (`import { z } from 'zod'`)
 * is foreign: never inferred, whatever it calls.
 * `aliases` maps a renamed local to its export (`import { a as b }` → b → a;
 * `import x` → x → `default`, which resolves only when the spec has that export).
 * With `localNames`, the default export's source name (`useSWR`) is an alias of
 * `default` on a page that imports that name from nowhere.
 */
export function collectPackageNamespaces(
  codes: readonly string[],
  exportNames: ReadonlySet<string>,
  packageName: string,
  importSpecifier?: string,
  localNames?: ReadonlyMap<string, string>,
): PackageNamespaces {
  const namespaces = new Set<string>();
  const namedImports = new Set<string>();
  const aliases = new Map<string, string>();
  const imported = new Set<string>();
  const foreign = new Set<string>();
  for (const code of codes) {
    for (const imp of extractFenceImports(code)) {
      imported.add(imp.name);
      if (!isPackageSpecifier(imp.from, packageName, importSpecifier)) {
        if (!isPackageModule(imp.from, packageName)) foreign.add(imp.name);
        continue;
      }
      if (imp.kind === 'namespace') namespaces.add(imp.name);
      else namedImports.add(imp.name);
      // A default import (either spelling) is the export named `default`, never
      // the export that happens to share the local name.
      if (imp.kind !== 'namespace' && imp.imported !== imp.name) {
        aliases.set(imp.name, imp.imported);
      }
    }
  }
  // The default export's source name, on a page that never imports that name.
  for (const [local, exportName] of localNames ?? []) {
    if (!imported.has(local) && !exportNames.has(local)) aliases.set(local, exportName);
  }
  const importedNamespaces = new Set(namespaces);
  if (namespaces.size === 0) {
    const hits = new Map<string, Set<string>>();
    for (const code of codes) {
      for (const call of extractFenceCalls(code)) {
        if (!exportNames.has(call.methodName)) continue;
        if (exportNames.has(call.objectName) || foreign.has(call.objectName)) continue;
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
  return { namespaces, importedNamespaces, namedImports, aliases };
}
