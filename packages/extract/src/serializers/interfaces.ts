import type { SpecExport, SpecMember, SpecSignature } from '@openpkg-ts/spec';
import ts from 'typescript';
import { extractTypeParameters, getJSDocComment, getSourceLocation } from '../ast/utils';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import type { SerializerContext } from './context';

export function serializeInterface(
  node: ts.InterfaceDeclaration,
  ctx: SerializerContext,
): SpecExport | null {
  const { typeChecker: checker } = ctx;
  const symbol = checker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const declSourceFile = node.getSourceFile();
  const { description, tags, examples } = getJSDocComment(node);
  const source = getSourceLocation(node, declSourceFile);

  // Extract type parameters like <T, K extends Base>
  const typeParameters = extractTypeParameters(node, checker);

  // Extract members: properties, methods, call signatures
  const members: SpecMember[] = [];
  const methodsByName = new Map<string, SpecMember>();

  for (const member of node.members) {
    if (ts.isPropertySignature(member)) {
      const propMember = serializePropertySignature(member, ctx);
      if (propMember) members.push(propMember);
    } else if (ts.isMethodSignature(member)) {
      const methodMember = serializeMethodSignature(member, ctx);
      if (methodMember && methodMember.name) {
        // Dedupe methods by name
        if (!methodsByName.has(methodMember.name)) {
          methodsByName.set(methodMember.name, methodMember);
        }
      }
    } else if (ts.isCallSignatureDeclaration(member)) {
      // Callable interface: interface Foo { (): void }
      const callMember = serializeCallSignature(member, ctx);
      if (callMember) members.push(callMember);
    } else if (ts.isIndexSignatureDeclaration(member)) {
      // Index signature: interface Foo { [key: string]: number }
      const indexMember = serializeIndexSignature(member, ctx);
      if (indexMember) members.push(indexMember);
    }
  }

  // Add deduplicated methods
  members.push(...methodsByName.values());

  // Extract extends clause
  const extendsClause = getInterfaceExtends(node, checker);

  return {
    id: name,
    name,
    kind: 'interface',
    description,
    tags,
    source,
    typeParameters,
    members: members.length > 0 ? members : undefined,
    extends: extendsClause,
    ...(examples.length > 0 ? { examples } : {}),
  };
}

function serializePropertySignature(
  node: ts.PropertySignature,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = node.name.getText();

  const { description, tags } = getJSDocComment(node);

  const type = checker.getTypeAtLocation(node);
  const schema = buildSchema(type, checker, ctx);
  registerReferencedTypes(type, ctx);

  const flags: Record<string, unknown> = {};
  if (node.questionToken) flags.optional = true;
  if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword)) {
    flags.readonly = true;
  }

  return {
    name,
    kind: 'property',
    description,
    tags: tags.length > 0 ? tags : undefined,
    schema,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}

function serializeMethodSignature(
  node: ts.MethodSignature,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = node.name.getText();

  const { description, tags } = getJSDocComment(node);

  const type = checker.getTypeAtLocation(node);
  const callSignatures = type.getCallSignatures();

  const signatures: SpecSignature[] = callSignatures.map((sig) => {
    const params = extractParameters(sig, ctx);
    const returnType = checker.getReturnTypeOfSignature(sig);
    registerReferencedTypes(returnType, ctx);

    return {
      parameters: params.length > 0 ? params : undefined,
      returns: {
        schema: buildSchema(returnType, checker, ctx),
      },
    };
  });

  const flags: Record<string, unknown> = {};
  if (node.questionToken) flags.optional = true;

  return {
    name,
    kind: 'method',
    description,
    tags: tags.length > 0 ? tags : undefined,
    signatures: signatures.length > 0 ? signatures : undefined,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}

function serializeCallSignature(
  node: ts.CallSignatureDeclaration,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const { description, tags } = getJSDocComment(node);

  const sig = checker.getSignatureFromDeclaration(node);
  if (!sig) return null;

  const params = extractParameters(sig, ctx);
  const returnType = checker.getReturnTypeOfSignature(sig);
  registerReferencedTypes(returnType, ctx);

  return {
    name: '()',
    kind: 'call-signature',
    description,
    tags: tags.length > 0 ? tags : undefined,
    signatures: [
      {
        parameters: params.length > 0 ? params : undefined,
        returns: {
          schema: buildSchema(returnType, checker, ctx),
        },
      },
    ],
  };
}

function serializeIndexSignature(
  node: ts.IndexSignatureDeclaration,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const { description, tags } = getJSDocComment(node);

  // Get the value type
  const valueType = node.type ? checker.getTypeAtLocation(node.type) : checker.getAnyType();
  const valueSchema = buildSchema(valueType, checker, ctx);
  registerReferencedTypes(valueType, ctx);

  // Get the key type (usually string or number)
  const keyParam = node.parameters[0];
  const keyType = keyParam?.type ? checker.getTypeAtLocation(keyParam.type) : checker.getStringType();
  const keyTypeName = checker.typeToString(keyType);

  return {
    name: `[${keyTypeName}]`,
    kind: 'index-signature',
    description,
    tags: tags.length > 0 ? tags : undefined,
    schema: {
      type: 'object',
      additionalProperties: valueSchema,
    },
  };
}

function getInterfaceExtends(
  node: ts.InterfaceDeclaration,
  checker: ts.TypeChecker,
): string | string[] | undefined {
  if (!node.heritageClauses) return undefined;

  for (const clause of node.heritageClauses) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.length > 0) {
      const names = clause.types.map((expr) => {
        const type = checker.getTypeAtLocation(expr);
        return type.getSymbol()?.getName() ?? expr.expression.getText();
      });
      // Return single string if one, array if multiple
      return names.length === 1 ? names[0] : names;
    }
  }
  return undefined;
}
