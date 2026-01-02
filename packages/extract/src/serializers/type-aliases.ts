import type { SpecExport } from '@openpkg-ts/spec';
import type ts from 'typescript';
import { extractTypeParameters, getJSDocComment, getSourceLocation } from '../ast/utils';
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

  // Extract type parameters like <T, K extends Base>
  const typeParameters = extractTypeParameters(node, ctx.typeChecker);

  const type = ctx.typeChecker.getTypeAtLocation(node);

  // Register referenced types FIRST (before buildSchema adds to visitedTypes)
  registerReferencedTypes(type, ctx);

  // Then build the schema
  const schema = buildSchema(type, ctx.typeChecker, ctx);

  return {
    id: name,
    name,
    kind: 'type',
    description,
    tags,
    source,
    typeParameters,
    schema,
    ...(examples.length > 0 ? { examples } : {}),
  };
}
