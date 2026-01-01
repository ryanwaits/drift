import type { SpecExport, SpecSignature } from '@openpkg-ts/spec';
import type ts from 'typescript';
import { getJSDocComment, getSourceLocation } from '../ast/utils';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import type { SerializerContext } from './context';

export function serializeFunctionExport(
  node: ts.FunctionDeclaration | ts.ArrowFunction,
  ctx: SerializerContext,
): SpecExport | null {
  // Get name from symbol (works across files) or fall back to node name
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const declSourceFile = node.getSourceFile();
  const { description, tags, examples } = getJSDocComment(node);
  const source = getSourceLocation(node, declSourceFile);

  const type = ctx.typeChecker.getTypeAtLocation(node);
  const callSignatures = type.getCallSignatures();

  const signatures: SpecSignature[] = callSignatures.map((sig) => {
    const params = extractParameters(sig, ctx);
    const returnType = ctx.typeChecker.getReturnTypeOfSignature(sig);

    // Register return type references
    registerReferencedTypes(returnType, ctx);

    return {
      parameters: params,
      returns: {
        schema: buildSchema(returnType, ctx.typeChecker, ctx),
      },
    };
  });

  return {
    id: name,
    name,
    kind: 'function',
    description,
    tags,
    source,
    signatures,
    ...(examples.length > 0 ? { examples } : {}),
  };
}
