import type { SpecExport } from '@openpkg-ts/spec';
import type ts from 'typescript';
import { getJSDocComment, getSourceLocation } from '../ast/utils';
import { registerReferencedTypes } from '../types/parameters';
import type { SerializerContext } from './context';

export function serializeVariable(
  node: ts.VariableDeclaration,
  statement: ts.VariableStatement,
  ctx: SerializerContext,
): SpecExport | null {
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name);
  const name = symbol?.getName() ?? node.name.getText();
  if (!name) return null;

  const declSourceFile = node.getSourceFile();
  const { description, tags, examples } = getJSDocComment(statement);
  const source = getSourceLocation(node, declSourceFile);
  const type = ctx.typeChecker.getTypeAtLocation(node);
  const typeString = ctx.typeChecker.typeToString(type);

  // Register referenced types
  registerReferencedTypes(type, ctx);

  return {
    id: name,
    name,
    kind: 'variable',
    description,
    tags,
    source,
    // Only include type if it's meaningful
    ...(typeString && typeString !== name ? { type: typeString } : {}),
    ...(examples.length > 0 ? { examples } : {}),
  };
}
