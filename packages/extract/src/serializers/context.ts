import type ts from 'typescript';
import { TypeRegistry } from '../ast/registry';

export interface SerializerContext {
  typeChecker: ts.TypeChecker;
  program: ts.Program;
  sourceFile: ts.SourceFile;
  maxTypeDepth: number;
  maxExternalTypeDepth: number;
  currentDepth: number;
  resolveExternalTypes: boolean;
  typeRegistry: TypeRegistry;
  exportedIds: Set<string>;
  /** Track visited types to prevent infinite recursion */
  visitedTypes: Set<ts.Type>;
}

export interface CreateContextOptions {
  maxTypeDepth?: number;
  maxExternalTypeDepth?: number;
  resolveExternalTypes?: boolean;
}

export function createContext(
  program: ts.Program,
  sourceFile: ts.SourceFile,
  options: CreateContextOptions = {},
): SerializerContext {
  return {
    typeChecker: program.getTypeChecker(),
    program,
    sourceFile,
    maxTypeDepth: options.maxTypeDepth ?? 4,
    maxExternalTypeDepth: options.maxExternalTypeDepth ?? 2,
    currentDepth: 0,
    resolveExternalTypes: options.resolveExternalTypes ?? true,
    typeRegistry: new TypeRegistry(),
    exportedIds: new Set<string>(),
    visitedTypes: new Set<ts.Type>(),
  };
}
