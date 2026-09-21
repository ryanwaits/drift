import type * as TS from 'typescript';
import type { ApiSpec } from '../analysis/api-spec';
import { expressionType, type ReferenceScope } from '../analysis/drift/prose-drift';
import type { ExportRegistry } from '../analysis/drift/types';
import { ts } from '../ts-module';

/** A token in a fence that names an export (`create`, `z.string`) or `Type.member` (`email`). */
export type FenceMention = {
  exportName: string;
  member?: string;
  /** The reference as written */
  text: string;
  /** 0-indexed line / column of `text` within the fence code */
  line: number;
  col: number;
};

export type MentionScope = {
  spec: ApiSpec;
  registry: ExportRegistry;
  /** `import * as ns` aliases of the entry, or the page's conventional alias */
  namespaces: ReadonlySet<string>;
  /** Renamed / default imports: local → export */
  aliases: ReadonlyMap<string, string>;
  /** Variable → spec type, from the page's visible bindings */
  bindings: ReadonlyMap<string, string>;
  /** Declared in the fence or earlier on the page, or imported from elsewhere: never the export */
  notOurs: ReadonlySet<string>;
};

/**
 * Callees of a fence that are certainly the package's, in source order:
 * - `f(...)` / `new f(...)`: the export `f` (through a renamed or default import too);
 * - `ns.f(...)` through a namespace alias: the export `f`, written `ns.f`;
 * - `<chain>.m(...)` where the receiver is itself a call whose spec type is
 *   known through return types alone (`z.string().email()`): `Type.m`, on the
 *   `m` token. First overload, no explicit type arguments, `this` stays the
 *   receiver; the chain ends at the first link the spec does not type.
 * A name in `notOurs` is the reader's own. Nothing here is a guess by name.
 */
export function extractFenceMentions(code: string, scope: MentionScope): FenceMention[] {
  const { spec, registry, namespaces, aliases, bindings, notOurs } = scope;
  const mentions: FenceMention[] = [];
  const derived = new Map<string, string>();
  for (const [name, bound] of bindings) {
    derived.set(name, registry.callableReturnTypes.get(bound) ?? bound);
  }
  const reference: ReferenceScope = { derived, params: new Map(), namespaces, aliases, notOurs };
  try {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const at = (node: TS.Node): { line: number; col: number } => {
      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      return { line: pos.line, col: pos.character };
    };
    const visit = (node: TS.Node): void => {
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const callee = node.expression;
        if (ts.isIdentifier(callee)) {
          if (!notOurs.has(callee.text)) {
            const exportName = aliases.get(callee.text) ?? callee.text;
            mentions.push({ exportName, text: callee.text, ...at(callee) });
          }
        } else if (ts.isPropertyAccessExpression(callee)) {
          const receiver = callee.expression;
          const name = callee.name.text;
          if (ts.isIdentifier(receiver)) {
            if (
              namespaces.has(receiver.text) &&
              !notOurs.has(receiver.text) &&
              name !== 'default'
            ) {
              const written = callee.getText(sourceFile);
              const text = `${receiver.text}.${name}`;
              mentions.push(
                written === text
                  ? { exportName: name, text, ...at(callee) }
                  : { exportName: name, text: name, ...at(callee.name) },
              );
            }
          } else if (ts.isCallExpression(node)) {
            const owner = chainHead(receiver)
              ? expressionType(receiver, registry, reference, spec)
              : undefined;
            if (owner && registry.typeMembers.get(name)?.has(owner)) {
              mentions.push({ exportName: owner, member: name, text: name, ...at(callee.name) });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  } catch {
    // parse failure
  }
  return mentions.sort((a, b) => a.line - b.line || a.col - b.col);
}

/** The receiver is a call (`f().m()`), not a variable: a chain. */
function chainHead(expr: TS.Expression): boolean {
  let e = expr;
  while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAwaitExpression(e)) {
    e = e.expression;
  }
  return ts.isCallExpression(e) || ts.isNewExpression(e);
}
