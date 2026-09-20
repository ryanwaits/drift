import type * as TS from 'typescript';
import type { MarkdownCodeBlock } from '../markdown/types';
import { ts } from '../ts-module';
import { isBuiltInIdentifier } from '../utils/builtin-detection';

export type FenceCall = {
  objectName: string;
  methodName: string;
  /** 0-indexed line within the code block value */
  line: number;
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
  name: string;
  from: string;
  line: number;
  text: string;
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
 * Named/default import specifiers with source text.
 */
/**
 * `const x = new Foo(...)` plus `const x = [await] Foo(...)` when `Foo` is a
 * known export. Later fences reuse earlier bindings.
 */
export function extractExportBindings(
  code: string,
  exportNames?: ReadonlySet<string>,
): Map<string, string> {
  const names = extractInstanceBindings(code);
  if (!exportNames || exportNames.size === 0) return names;
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
      if (
        (ts.isCallExpression(expr) || ts.isNewExpression(expr)) &&
        ts.isIdentifier(expr.expression) &&
        exportNames.has(expr.expression.text)
      ) {
        names.set(name, expr.expression.text);
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
  line: number;
  text: string;
};

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
          sites.push({
            kind: 'call',
            name: expr.text,
            argCount,
            hasSpreadArg,
            args,
            jsxKeys: [],
            hasJsxSpread: false,
            hasChildren: false,
            line: pos.line,
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
            line: pos.line,
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
          line: pos.line,
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
            line: pos.line,
            text: node.getText(sourceFile),
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
      const lineOf = (n: TS.Node): number =>
        sourceFile.getLineAndCharacterOfPosition(n.getStart()).line;
      if (clause.name) {
        imports.push({
          name: clause.name.text,
          from,
          line: lineOf(clause.name),
          text: clause.name.getText(sourceFile),
        });
      }
      const named = clause.namedBindings;
      if (named && ts.isNamespaceImport(named)) {
        imports.push({
          name: named.name.text,
          from,
          line: lineOf(named.name),
          text: named.name.getText(sourceFile),
        });
      }
      if (named && ts.isNamedImports(named)) {
        for (const el of named.elements) {
          imports.push({
            name: el.name.text,
            from,
            line: lineOf(el.name),
            text: el.name.getText(sourceFile),
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
