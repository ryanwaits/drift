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
