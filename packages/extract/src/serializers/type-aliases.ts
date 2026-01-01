import type { SpecExport } from '@openpkg-ts/spec';
import type ts from 'typescript';
import { getJSDocComment, getSourceLocation } from '../ast/utils';
import { registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import type { SerializerContext } from './context';

export function serializeTypeAlias(
  node: ts.TypeAliasDeclaration,
  ctx: SerializerContext,
): SpecExport | null {
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const declSourceFile = node.getSourceFile();
  const { description, tags, examples } = getJSDocComment(node);
  const source = getSourceLocation(node, declSourceFile);
  const type = ctx.typeChecker.getTypeAtLocation(node);

  // Register referenced types
  registerReferencedTypes(type, ctx);

  return {
    id: name,
    name,
    kind: 'type',
    description,
    tags,
    source,
    schema: buildSchema(type, ctx.typeChecker, ctx),
    ...(examples.length > 0 ? { examples } : {}),
  };
}
