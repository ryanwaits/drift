import type ts from 'typescript';
import { TypeRegistry } from '../ast/registry';

export interface SerializerContext {
  typeChecker: ts.TypeChecker;
  program: ts.Program;
  sourceFile: ts.SourceFile;
  maxTypeDepth: number;
  resolveExternalTypes: boolean;
  typeRegistry: TypeRegistry;
  exportedIds: Set<string>;
  /** Track visited types to prevent infinite recursion */
  visitedTypes: Set<ts.Type>;
}

export function createContext(
  program: ts.Program,
  sourceFile: ts.SourceFile,
  options: { maxTypeDepth?: number; resolveExternalTypes?: boolean } = {},
): SerializerContext {
  return {
    typeChecker: program.getTypeChecker(),
    program,
    sourceFile,
    maxTypeDepth: options.maxTypeDepth ?? 20,
    resolveExternalTypes: options.resolveExternalTypes ?? true,
    typeRegistry: new TypeRegistry(),
    exportedIds: new Set<string>(),
    visitedTypes: new Set<ts.Type>(),
  };
}
