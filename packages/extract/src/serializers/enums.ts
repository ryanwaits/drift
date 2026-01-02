import type { SpecExport, SpecMember, SpecSchema } from '@openpkg-ts/spec';
import type ts from 'typescript';
import { getJSDocComment, getSourceLocation } from '../ast/utils';
import type { SerializerContext } from './context';

export function serializeEnum(node: ts.EnumDeclaration, ctx: SerializerContext): SpecExport | null {
  const { typeChecker: checker } = ctx;
  const symbol = checker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const declSourceFile = node.getSourceFile();
  const { description, tags, examples } = getJSDocComment(node);
  const source = getSourceLocation(node, declSourceFile);

  const members: SpecMember[] = node.members.map((member) => {
    const memberSymbol = checker.getSymbolAtLocation(member.name);
    const memberName = memberSymbol?.getName() ?? member.name.getText();

    // Get the constant value
    const constantValue = checker.getConstantValue(member);

    // Build schema based on value type
    let schema: SpecSchema | undefined;
    if (typeof constantValue === 'string') {
      schema = { type: 'string', enum: [constantValue] };
    } else if (typeof constantValue === 'number') {
      schema = { type: 'number', enum: [constantValue] };
    } else if (member.initializer) {
      // Computed value - fall back to expression text
      schema = { type: member.initializer.getText() };
    }

    const { description: memberDesc } = getJSDocComment(member);

    return {
      id: memberName,
      name: memberName,
      kind: 'enum-member',
      ...(schema ? { schema } : {}),
      ...(memberDesc ? { description: memberDesc } : {}),
    };
  });

  return {
    id: name,
    name,
    kind: 'enum',
    description,
    tags,
    source,
    members,
    ...(examples.length > 0 ? { examples } : {}),
  };
}
