import * as tsNamespace from 'typescript';

export type TypeScriptModule = typeof tsNamespace;

const resolvedTypeScriptModule: TypeScriptModule = (() => {
  const candidate = tsNamespace as TypeScriptModule & {
    default?: TypeScriptModule;
  };
  if (
    (candidate as Partial<TypeScriptModule>).ScriptTarget === undefined &&
    typeof candidate.default !== 'undefined'
  ) {
    return candidate.default as TypeScriptModule;
  }
  return candidate;
})();

export const ts: TypeScriptModule = resolvedTypeScriptModule;
