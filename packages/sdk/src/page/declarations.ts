import type * as TS from 'typescript';
import { ts } from '../ts-module';

/** One property / method key a printed declaration body declares. */
export type DeclaredKey = {
  name: string;
  /** The member's own source text (`args: unknown;`) */
  text: string;
  /** 0-indexed line / column of `text` within the fence code */
  line: number;
  col: number;
};

/** A top-level `interface X {}` / `type X = {}` / `class X {}` a fence prints. */
export type FenceDeclaration = {
  name: string;
  kind: 'interface' | 'type' | 'class';
  exported: boolean;
  keys: DeclaredKey[];
};

function isExported(node: TS.Node): boolean {
  return (ts.getCombinedModifierFlags(node as TS.Declaration) & ts.ModifierFlags.Export) !== 0;
}

function isHidden(node: TS.Node): boolean {
  const flags = ts.getCombinedModifierFlags(node as TS.Declaration);
  return (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) !== 0;
}

/** Plain member name: an identifier or string literal, never computed or `#private`. */
function memberName(name: TS.PropertyName | undefined): string | undefined {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

function keyOf(node: TS.Node, name: string, sourceFile: TS.SourceFile): DeclaredKey {
  const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { name, text: node.getText(sourceFile), line: pos.line, col: pos.character };
}

function typeElementKeys(
  members: readonly TS.TypeElement[],
  sourceFile: TS.SourceFile,
): DeclaredKey[] {
  const keys: DeclaredKey[] = [];
  for (const m of members) {
    if (
      !ts.isPropertySignature(m) &&
      !ts.isMethodSignature(m) &&
      !ts.isGetAccessorDeclaration(m) &&
      !ts.isSetAccessorDeclaration(m)
    ) {
      continue;
    }
    const name = memberName(m.name);
    if (name) keys.push(keyOf(m, name, sourceFile));
  }
  return keys;
}

/** Keys of a type-alias body: an object literal type, or every literal arm of an intersection. */
function typeNodeKeys(type: TS.TypeNode, sourceFile: TS.SourceFile): DeclaredKey[] | null {
  if (ts.isTypeLiteralNode(type)) return typeElementKeys(type.members, sourceFile);
  if (ts.isIntersectionTypeNode(type)) {
    const literals = type.types.filter(ts.isTypeLiteralNode);
    if (literals.length === 0) return null;
    return literals.flatMap((t) => typeElementKeys(t.members, sourceFile));
  }
  return null;
}

function classKeys(members: readonly TS.ClassElement[], sourceFile: TS.SourceFile): DeclaredKey[] {
  const keys: DeclaredKey[] = [];
  for (const m of members) {
    if (
      !ts.isPropertyDeclaration(m) &&
      !ts.isMethodDeclaration(m) &&
      !ts.isGetAccessorDeclaration(m) &&
      !ts.isSetAccessorDeclaration(m)
    ) {
      continue;
    }
    if (isHidden(m)) continue;
    const name = memberName(m.name);
    if (name) keys.push(keyOf(m, name, sourceFile));
  }
  return keys;
}

/**
 * Top-level declarations a fence prints with a body of keys. A type alias of
 * anything but an object literal type (or an intersection with one) is not a
 * body. Private / protected class members are not keys.
 */
export function extractFenceDeclarations(code: string): FenceDeclaration[] {
  const out: FenceDeclaration[] = [];
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isInterfaceDeclaration(node)) {
        out.push({
          name: node.name.text,
          kind: 'interface',
          exported: isExported(node),
          keys: typeElementKeys(node.members, sourceFile),
        });
      } else if (ts.isTypeAliasDeclaration(node)) {
        const keys = typeNodeKeys(node.type, sourceFile);
        if (keys) {
          out.push({ name: node.name.text, kind: 'type', exported: isExported(node), keys });
        }
      } else if (ts.isClassDeclaration(node) && node.name) {
        out.push({
          name: node.name.text,
          kind: 'class',
          exported: isExported(node),
          keys: classKeys(node.members, sourceFile),
        });
      }
    });
  } catch {
    // parse failure: no declarations
  }
  return out;
}
