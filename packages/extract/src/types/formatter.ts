import type ts from 'typescript';

export function formatTypeReference(type: ts.Type, checker: ts.TypeChecker): string {
  return checker.typeToString(type);
}

export function collectReferencedTypes(
  type: ts.Type,
  checker: ts.TypeChecker,
  visited: Set<string> = new Set<string>(),
): string[] {
  const symbol = type.getSymbol();
  if (!symbol) return [];

  const name = symbol.getName();
  if (visited.has(name)) return [];
  visited.add(name);

  // TODO: Recursively collect referenced types
  return [name];
}
