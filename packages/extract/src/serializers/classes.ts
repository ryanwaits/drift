import type { SpecExport, SpecMember, SpecSignature, SpecVisibility } from '@openpkg-ts/spec';
import ts from 'typescript';
import { extractTypeParameters, getJSDocComment, getSourceLocation } from '../ast/utils';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import type { SerializerContext } from './context';

export function serializeClass(
  node: ts.ClassDeclaration,
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

  // Extract members: properties, methods, constructor
  const members: SpecMember[] = [];
  const signatures: SpecSignature[] = [];
  const methodsByName = new Map<string, SpecMember>();

  for (const member of node.members) {
    // Skip private members (start with #)
    const memberName = getMemberName(member);
    if (memberName?.startsWith('#')) continue;

    if (ts.isPropertyDeclaration(member)) {
      const propMember = serializeProperty(member, ctx);
      if (propMember) members.push(propMember);
    } else if (ts.isMethodDeclaration(member)) {
      const methodMember = serializeMethod(member, ctx);
      if (methodMember?.name) {
        // Dedupe methods by name - only first declaration captures all overloads
        if (!methodsByName.has(methodMember.name)) {
          methodsByName.set(methodMember.name, methodMember);
        } else {
          // Keep first description/tags if missing
          const existing = methodsByName.get(methodMember.name)!;
          if (!existing.description && methodMember.description) {
            existing.description = methodMember.description;
          }
          if (!existing.tags && methodMember.tags) {
            existing.tags = methodMember.tags;
          }
        }
      }
    } else if (ts.isConstructorDeclaration(member)) {
      const ctorSig = serializeConstructor(member, ctx);
      if (ctorSig) signatures.push(ctorSig);
    } else if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
      const accessorMember = serializeAccessor(member, ctx);
      if (accessorMember) members.push(accessorMember);
    }
  }

  // Add deduplicated methods
  members.push(...methodsByName.values());

  // Extract extends clause
  const extendsClause = getExtendsClause(node, checker);

  // Extract implements clause
  const implementsClause = getImplementsClause(node, checker);

  return {
    id: name,
    name,
    kind: 'class',
    description,
    tags,
    source,
    typeParameters,
    members: members.length > 0 ? members : undefined,
    signatures: signatures.length > 0 ? signatures : undefined,
    extends: extendsClause,
    implements: implementsClause?.length ? implementsClause : undefined,
    ...(examples.length > 0 ? { examples } : {}),
  };
}

function getMemberName(member: ts.ClassElement): string | undefined {
  if (ts.isConstructorDeclaration(member)) return 'constructor';
  if (!member.name) return undefined;
  if (ts.isIdentifier(member.name)) return member.name.text;
  if (ts.isPrivateIdentifier(member.name)) return member.name.text;
  return member.name.getText();
}

function getVisibility(member: ts.ClassElement): SpecVisibility | undefined {
  const modifiers = ts.getModifiers(member);
  if (!modifiers) return undefined;

  for (const mod of modifiers) {
    if (mod.kind === ts.SyntaxKind.PrivateKeyword) return 'private';
    if (mod.kind === ts.SyntaxKind.ProtectedKeyword) return 'protected';
    if (mod.kind === ts.SyntaxKind.PublicKeyword) return 'public';
  }
  return undefined;
}

function isStatic(member: ts.ClassElement): boolean {
  const modifiers = ts.getModifiers(member);
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false;
}

function isReadonly(member: ts.ClassElement): boolean {
  const modifiers = ts.getModifiers(member);
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false;
}

function serializeProperty(
  node: ts.PropertyDeclaration,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = getMemberName(node);
  if (!name) return null;

  const { description, tags } = getJSDocComment(node);
  const visibility = getVisibility(node);

  // Get property type
  const type = checker.getTypeAtLocation(node);

  // Register referenced types FIRST (before buildSchema adds to visitedTypes)
  registerReferencedTypes(type, ctx);

  // Then build the schema
  const schema = buildSchema(type, checker, ctx);

  const flags: Record<string, unknown> = {};
  if (isStatic(node)) flags.static = true;
  if (isReadonly(node)) flags.readonly = true;
  if (node.questionToken) flags.optional = true;

  return {
    name,
    kind: 'property',
    description,
    tags: tags.length > 0 ? tags : undefined,
    visibility,
    schema,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}

function serializeMethod(node: ts.MethodDeclaration, ctx: SerializerContext): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = getMemberName(node);
  if (!name) return null;

  const { description, tags } = getJSDocComment(node);
  const visibility = getVisibility(node);

  // Get method signatures
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
  if (isStatic(node)) flags.static = true;
  if (node.asteriskToken) flags.generator = true;

  // Check for async
  const modifiers = ts.getModifiers(node);
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
    flags.async = true;
  }

  return {
    name,
    kind: 'method',
    description,
    tags: tags.length > 0 ? tags : undefined,
    visibility,
    signatures: signatures.length > 0 ? signatures : undefined,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}

function serializeConstructor(
  node: ts.ConstructorDeclaration,
  ctx: SerializerContext,
): SpecSignature | null {
  const { typeChecker: checker } = ctx;
  const { description } = getJSDocComment(node);

  const sig = checker.getSignatureFromDeclaration(node);
  if (!sig) return null;

  const params = extractParameters(sig, ctx);

  return {
    description,
    parameters: params.length > 0 ? params : undefined,
  };
}

function serializeAccessor(
  node: ts.GetAccessorDeclaration | ts.SetAccessorDeclaration,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = getMemberName(node);
  if (!name) return null;

  const { description, tags } = getJSDocComment(node);
  const visibility = getVisibility(node);

  const type = checker.getTypeAtLocation(node);
  const schema = buildSchema(type, checker, ctx);
  registerReferencedTypes(type, ctx);

  const kind = ts.isGetAccessorDeclaration(node) ? 'getter' : 'setter';

  const flags: Record<string, unknown> = {};
  if (isStatic(node)) flags.static = true;

  return {
    name,
    kind,
    description,
    tags: tags.length > 0 ? tags : undefined,
    visibility,
    schema,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}

function getExtendsClause(node: ts.ClassDeclaration, checker: ts.TypeChecker): string | undefined {
  if (!node.heritageClauses) return undefined;

  for (const clause of node.heritageClauses) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
      const expr = clause.types[0];
      if (expr) {
        const type = checker.getTypeAtLocation(expr);
        const symbol = type.getSymbol();
        return symbol?.getName() ?? expr.expression.getText();
      }
    }
  }
  return undefined;
}

function getImplementsClause(
  node: ts.ClassDeclaration,
  checker: ts.TypeChecker,
): string[] | undefined {
  if (!node.heritageClauses) return undefined;

  for (const clause of node.heritageClauses) {
    if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
      return clause.types.map((expr) => {
        const type = checker.getTypeAtLocation(expr);
        const symbol = type.getSymbol();
        return symbol?.getName() ?? expr.expression.getText();
      });
    }
  }
  return undefined;
}
