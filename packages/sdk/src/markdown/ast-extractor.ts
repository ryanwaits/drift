/**
 * AST-based code extraction using TypeScript compiler API.
 *
 * Replaces regex-based extraction with proper AST parsing to correctly handle:
 * - All import forms (default, namespace, named, type-only, dynamic)
 * - Call expressions (distinguishing from type references)
 * - Method calls on objects
 */

import type * as TS from 'typescript';
import { ts } from '../ts-module';
import { isBuiltInIdentifier } from '../utils/builtin-detection';

export interface ImportInfo {
  /** The imported name (local binding) */
  name: string;
  /** The module specifier */
  from: string;
  /** Whether this is a type-only import */
  isTypeOnly: boolean;
  /** Import kind: 'named', 'default', 'namespace', 'side-effect' */
  kind: 'named' | 'default' | 'namespace' | 'side-effect';
}

export interface CallInfo {
  /** The function/method name being called */
  name: string;
  /** Line number (0-indexed) */
  line: number;
  /** Whether this is a method call (obj.method()) */
  isMethodCall: boolean;
  /** The object name if this is a method call */
  objectName?: string;
}

export interface MethodCallInfo {
  /** The object/variable name (e.g., "client") */
  objectName: string;
  /** The method being called (e.g., "evaluateChainhook") */
  methodName: string;
  /** Line number (0-indexed) */
  line: number;
  /** The full line context */
  context: string;
}

/**
 * Extract all imports from TypeScript/JavaScript code using AST parsing.
 *
 * Handles:
 * - Named imports: import { X, Y } from 'pkg'
 * - Default imports: import X from 'pkg'
 * - Namespace imports: import * as X from 'pkg'
 * - Side-effect imports: import 'pkg'
 * - Type-only imports: import type { X } from 'pkg'
 * - Mixed imports: import X, { Y } from 'pkg'
 * - Dynamic imports: await import('pkg') (returns empty for these)
 */
export function extractImportsAST(code: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (!ts.isStringLiteral(moduleSpecifier)) return;

        const from = moduleSpecifier.text;
        const importClause = node.importClause;

        // Side-effect import: import 'pkg'
        if (!importClause) {
          imports.push({ name: '', from, isTypeOnly: false, kind: 'side-effect' });
          return;
        }

        const isTypeOnly = importClause.isTypeOnly ?? false;

        // Default import: import X from 'pkg'
        if (importClause.name) {
          imports.push({
            name: importClause.name.text,
            from,
            isTypeOnly,
            kind: 'default',
          });
        }

        // Named/Namespace bindings
        const namedBindings = importClause.namedBindings;
        if (namedBindings) {
          if (ts.isNamespaceImport(namedBindings)) {
            // Namespace import: import * as X from 'pkg'
            imports.push({
              name: namedBindings.name.text,
              from,
              isTypeOnly,
              kind: 'namespace',
            });
          } else if (ts.isNamedImports(namedBindings)) {
            // Named imports: import { X, Y, Z } from 'pkg'
            for (const element of namedBindings.elements) {
              const localName = element.name.text;
              const isElementTypeOnly = element.isTypeOnly ?? isTypeOnly;
              imports.push({
                name: localName,
                from,
                isTypeOnly: isElementTypeOnly,
                kind: 'named',
              });
            }
          }
        }
      }
    });
  } catch {
    // If parsing fails, return empty array
  }

  return imports;
}

/**
 * Extract all function/method calls from TypeScript/JavaScript code using AST parsing.
 *
 * Handles:
 * - Simple calls: foo()
 * - Method calls: obj.method()
 * - Chained calls: obj.a().b()
 * - Generic calls: foo<T>()
 * - IIFE: (function() {})()
 *
 * Excludes:
 * - Type references: const x: Foo<T>
 * - Type assertions: x as Foo
 * - Class declarations: class Foo {}
 */
export function extractCallsAST(code: string): CallInfo[] {
  const calls: CallInfo[] = [];
  const _lines = code.split('\n');

  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    function visit(node: TS.Node) {
      if (ts.isCallExpression(node)) {
        const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;

        // Check what kind of call this is
        const expression = node.expression;

        if (ts.isIdentifier(expression)) {
          // Simple call: foo()
          const name = expression.text;
          if (!isKeyword(name)) {
            calls.push({
              name,
              line: lineNumber,
              isMethodCall: false,
            });
          }
        } else if (ts.isPropertyAccessExpression(expression)) {
          // Method call: obj.method()
          const methodName = expression.name.text;
          const objectExpr = expression.expression;

          // Get the root object name
          let objectName: string | undefined;
          if (ts.isIdentifier(objectExpr)) {
            objectName = objectExpr.text;
          } else if (ts.isPropertyAccessExpression(objectExpr)) {
            // Chained: a.b.c() - get the leftmost identifier
            let current: TS.Expression = objectExpr;
            while (ts.isPropertyAccessExpression(current)) {
              current = current.expression;
            }
            if (ts.isIdentifier(current)) {
              objectName = current.text;
            }
          } else if (ts.isCallExpression(objectExpr)) {
            // Chained call: foo().bar()
            objectName = undefined;
          }

          calls.push({
            name: methodName,
            line: lineNumber,
            isMethodCall: true,
            objectName,
          });
        }
      }

      // Also check for new expressions: new Foo()
      if (ts.isNewExpression(node)) {
        const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const expression = node.expression;

        if (ts.isIdentifier(expression)) {
          calls.push({
            name: expression.text,
            line: lineNumber,
            isMethodCall: false,
          });
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  } catch {
    // If parsing fails, return empty array
  }

  return calls;
}

/**
 * Extract method calls specifically (obj.method pattern).
 * Returns more detailed info including line context.
 */
export function extractMethodCallsAST(code: string): MethodCallInfo[] {
  const calls: MethodCallInfo[] = [];
  const lines = code.split('\n');

  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    function visit(node: TS.Node) {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;

        if (ts.isPropertyAccessExpression(expression)) {
          const methodName = expression.name.text;
          const objectExpr = expression.expression;
          const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;

          // Get the immediate object name
          let objectName: string | undefined;
          if (ts.isIdentifier(objectExpr)) {
            objectName = objectExpr.text;
          } else if (ts.isPropertyAccessExpression(objectExpr)) {
            // For chained access like a.b.method(), get 'a.b' or just 'a'
            if (ts.isIdentifier(objectExpr.expression)) {
              objectName = objectExpr.expression.text;
            }
          } else if (objectExpr.kind === ts.SyntaxKind.ThisKeyword) {
            objectName = 'this';
          }

          // Skip built-in objects
          if (objectName && !isBuiltInIdentifier(objectName)) {
            calls.push({
              objectName,
              methodName,
              line: lineNumber,
              context: lines[lineNumber]?.trim() ?? '',
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  } catch {
    // If parsing fails, return empty array
  }

  return calls;
}

/**
 * Extract all identifier references from code.
 * Used for finding references to exported symbols.
 */
export function extractIdentifierReferences(code: string): Set<string> {
  const identifiers = new Set<string>();

  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    function visit(node: TS.Node) {
      // Skip type nodes - we only want value references
      if (
        ts.isTypeNode(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isInterfaceDeclaration(node)
      ) {
        return;
      }

      if (ts.isIdentifier(node)) {
        const parent = node.parent;

        // Skip if this is a declaration name
        if (isDeclarationName(node, parent)) {
          return;
        }

        // Skip if this is a property name in an object literal
        if (parent && ts.isPropertyAssignment(parent) && parent.name === node) {
          return;
        }

        // Skip if this is a property name in a property access (the rightmost part)
        if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) {
          // But include if it's a call expression parent (method call)
          const grandparent = parent.parent;
          if (
            grandparent &&
            ts.isCallExpression(grandparent) &&
            grandparent.expression === parent
          ) {
            identifiers.add(node.text);
          }
          return;
        }

        const name = node.text;
        if (!isKeyword(name) && !isBuiltInIdentifier(name)) {
          identifiers.add(name);
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  } catch {
    // If parsing fails, return empty set
  }

  return identifiers;
}

/**
 * Check if code contains a class instantiation (new ClassName()).
 * Uses AST to avoid false positives from strings/comments.
 */
export function hasInstantiationAST(code: string, className: string): boolean {
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    let found = false;

    function visit(node: TS.Node) {
      if (found) return;

      if (ts.isNewExpression(node)) {
        const expression = node.expression;
        if (ts.isIdentifier(expression) && expression.text === className) {
          found = true;
          return;
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return found;
  } catch {
    return false;
  }
}

/**
 * Check if an identifier is a declaration name (not a reference).
 */
function isDeclarationName(node: TS.Identifier, parent: TS.Node | undefined): boolean {
  if (!parent) return false;

  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  if (ts.isClassDeclaration(parent) && parent.name === node) return true;
  if (ts.isParameter(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return true;
  if (ts.isImportSpecifier(parent) && parent.name === node) return true;
  if (ts.isBindingElement(parent) && parent.name === node) return true;

  return false;
}

/**
 * Check if a name is a JavaScript/TypeScript keyword.
 */
function isKeyword(name: string): boolean {
  const keywords = new Set([
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'let',
    'new',
    'null',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield',
    'async',
    'await',
    'of',
    // TypeScript keywords
    'abstract',
    'as',
    'asserts',
    'declare',
    'get',
    'implements',
    'interface',
    'is',
    'keyof',
    'module',
    'namespace',
    'never',
    'readonly',
    'require',
    'set',
    'type',
    'unknown',
  ]);

  return keywords.has(name);
}

// Re-export legacy function signatures for backward compatibility
// These wrap the AST-based functions to match the old interface

/**
 * Extract import statements from code (legacy interface).
 * @deprecated Use extractImportsAST for more detailed info.
 */
export function extractImports(code: string): Array<{ name: string; from: string }> {
  return extractImportsAST(code)
    .filter((imp) => imp.kind !== 'side-effect' && imp.name)
    .map((imp) => ({ name: imp.name, from: imp.from }));
}

/**
 * Extract function calls from code (legacy interface).
 * @deprecated Use extractCallsAST for more detailed info.
 */
export function extractFunctionCalls(code: string): string[] {
  const calls = extractCallsAST(code);
  const uniqueNames = new Set<string>();

  for (const call of calls) {
    if (!call.isMethodCall) {
      uniqueNames.add(call.name);
    }
  }

  return Array.from(uniqueNames);
}

/**
 * Extract method calls from code (legacy interface).
 */
export function extractMethodCalls(code: string): MethodCallInfo[] {
  return extractMethodCallsAST(code);
}
