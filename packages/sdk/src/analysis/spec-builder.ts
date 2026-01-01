import * as fs from 'node:fs';
import * as path from 'node:path';
import { SCHEMA_URL, SCHEMA_VERSION, type SpecGenerationInfo } from '@openpkg-ts/spec';
import type * as TS from 'typescript';
import { ts } from '../ts-module';

import type { AnalysisContext } from './context';
import { serializeClass } from './serializers/classes';
import { serializeEnum } from './serializers/enums';
import { type SerializerContext, serializeFunctionExport } from './serializers/functions';
import { serializeInterface } from './serializers/interfaces';
import { serializeNamespace } from './serializers/namespaces';
import { serializeTypeAlias } from './serializers/type-aliases';
import { serializeVariable } from './serializers/variables';
import type { OpenPkgSpec } from './spec-types';
import { TypeRegistry } from './type-registry';

/**
 * Create a default generation info for cases where it's not provided.
 * This ensures the spec always has valid generation metadata.
 */
function createDefaultGenerationInfo(entryFile: string): SpecGenerationInfo {
  return {
    timestamp: new Date().toISOString(),
    generator: {
      name: '@doccov/sdk',
      version: '0.0.0', // Will be replaced by actual version at runtime
    },
    analysis: {
      entryPoint: entryFile,
      entryPointSource: 'explicit',
      isDeclarationOnly: entryFile.endsWith('.d.ts'),
      resolvedExternalTypes: false,
    },
    environment: {
      hasNodeModules: false,
    },
    issues: [],
  };
}

export function buildOpenPkgSpec(
  context: AnalysisContext,
  resolveExternalTypes: boolean,
  generation?: SpecGenerationInfo,
): OpenPkgSpec {
  const { baseDir, checker: typeChecker, sourceFile, program, entryFile } = context;

  const packageJsonPath = path.join(baseDir, 'package.json');
  const packageJson = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    : {};

  // Use provided generation info or create a default
  const generationInfo =
    generation ?? createDefaultGenerationInfo(path.relative(baseDir, entryFile));

  const spec: OpenPkgSpec = {
    $schema: SCHEMA_URL,
    openpkg: SCHEMA_VERSION,
    meta: {
      name: packageJson.name || 'unknown',
      version: packageJson.version || '1.0.0',
      description: packageJson.description || '',
      license: packageJson.license || '',
      repository: packageJson.repository?.url || packageJson.repository || '',
      ecosystem: 'js/ts',
    },
    exports: [],
    types: [],
    generation: generationInfo,
  };

  const typeRegistry = new TypeRegistry();
  const serializerContext: SerializerContext = {
    checker: typeChecker,
    typeRegistry,
    maxTypeDepth: context.options.maxDepth,
    detectedSchemas: context.detectedSchemas,
  };

  const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return spec;
  }

  const exportedSymbols = typeChecker.getExportsOfModule(moduleSymbol);

  for (const symbol of exportedSymbols) {
    const { declaration, targetSymbol } = resolveExportTarget(symbol, typeChecker);
    if (!declaration) continue;

    const exportName = symbol.getName();

    if (
      ts.isClassDeclaration(declaration) ||
      ts.isInterfaceDeclaration(declaration) ||
      ts.isTypeAliasDeclaration(declaration) ||
      ts.isEnumDeclaration(declaration)
    ) {
      typeRegistry.registerExportedType(exportName, targetSymbol.getName());
    }
  }

  for (const symbol of exportedSymbols) {
    const { declaration, targetSymbol } = resolveExportTarget(symbol, typeChecker);
    if (!declaration) continue;

    const exportName = symbol.getName();

    if (ts.isFunctionDeclaration(declaration)) {
      const exportEntry = serializeFunctionExport(declaration, targetSymbol, serializerContext);
      addExport(spec, exportEntry, exportName, baseDir);
    } else if (ts.isClassDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeClass(
        declaration,
        targetSymbol,
        serializerContext,
      );
      addExport(spec, exportEntry, exportName, baseDir);
      addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir, exportName);
    } else if (ts.isInterfaceDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeInterface(
        declaration,
        targetSymbol,
        serializerContext,
      );
      addExport(spec, exportEntry, exportName, baseDir);
      addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir, exportName);
    } else if (ts.isTypeAliasDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeTypeAlias(
        declaration,
        targetSymbol,
        serializerContext,
      );
      addExport(spec, exportEntry, exportName, baseDir);
      addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir, exportName);
    } else if (ts.isEnumDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeEnum(
        declaration,
        targetSymbol,
        serializerContext,
      );
      addExport(spec, exportEntry, exportName, baseDir);
      addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir, exportName);
    } else if (ts.isVariableDeclaration(declaration)) {
      const exportEntry = serializeVariable(declaration, targetSymbol, serializerContext);
      addExport(spec, exportEntry, exportName, baseDir);
    } else if (ts.isModuleDeclaration(declaration)) {
      const exportEntry = serializeNamespace(declaration, targetSymbol, serializerContext);
      addExport(spec, exportEntry, exportName, baseDir);
    }
  }

  for (const typeName of typeRegistry.getReferencedTypes()) {
    if (typeRegistry.isKnownType(typeName)) {
      continue;
    }

    const allSourceFiles = program.getSourceFiles();

    for (const file of allSourceFiles) {
      if (
        !resolveExternalTypes &&
        (file.fileName.includes('node_modules') ||
          (file.fileName.endsWith('.d.ts') && !file.fileName.startsWith(baseDir)))
      ) {
        continue;
      }

      const fileSymbol = typeChecker.getSymbolAtLocation(file);
      if (!fileSymbol) {
        continue;
      }

      const exports = typeChecker.getExportsOfModule(fileSymbol);

      for (const exportSymbol of exports) {
        if (exportSymbol.getName() !== typeName || typeRegistry.isKnownType(typeName)) {
          continue;
        }

        const { declaration, targetSymbol } = resolveExportTarget(exportSymbol, typeChecker);
        if (!declaration) continue;

        if (ts.isClassDeclaration(declaration)) {
          const { typeDefinition } = serializeClass(declaration, targetSymbol, serializerContext);
          addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
        } else if (ts.isInterfaceDeclaration(declaration)) {
          const { typeDefinition } = serializeInterface(
            declaration,
            targetSymbol,
            serializerContext,
          );
          addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
        } else if (ts.isTypeAliasDeclaration(declaration)) {
          const { typeDefinition } = serializeTypeAlias(
            declaration,
            targetSymbol,
            serializerContext,
          );
          addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
        } else if (ts.isEnumDeclaration(declaration)) {
          const { typeDefinition } = serializeEnum(declaration, targetSymbol, serializerContext);
          addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
        }
      }
    }
  }

  // Emit stub definitions for unresolved external types
  for (const typeName of typeRegistry.getReferencedTypes()) {
    if (typeRegistry.isKnownType(typeName)) {
      continue;
    }

    // This type couldn't be resolved - create a stub external type definition
    const stubDefinition = {
      id: typeName,
      name: typeName,
      kind: 'external' as const,
      description: `External type (not resolved)`,
    };

    if (typeRegistry.registerTypeDefinition(stubDefinition)) {
      spec.types?.push(stubDefinition);
    }
  }

  // Note: Coverage is computed separately via buildDocCovSpec(), not during spec building
  return spec;
}

function addExport(
  spec: OpenPkgSpec,
  entry: OpenPkgSpec['exports'][number],
  exportName: string,
  baseDir: string,
): void {
  const named = withExportName(entry, exportName);
  spec.exports.push(applyPresentationDefaults(named, baseDir));
}

function addTypeDefinition(
  spec: OpenPkgSpec,
  typeRegistry: TypeRegistry,
  definition: NonNullable<OpenPkgSpec['types']>[number] | undefined,
  baseDir: string,
  exportAlias?: string,
): void {
  if (!definition) {
    return;
  }

  // If the export name differs from the original type name, preserve both
  // - id: the public/exported name (for $ref matching)
  // - name: the original name in source (matches source location)
  // - alias: only present when re-exported with a different name
  let finalDefinition = definition;
  if (exportAlias && exportAlias !== definition.name) {
    finalDefinition = {
      ...definition,
      id: exportAlias,
      // Keep original name (matches source file)
      name: definition.name,
      // Add alias to indicate re-export
      alias: exportAlias,
    };
  }

  const enriched = applyPresentationDefaults(finalDefinition, baseDir);
  if (typeRegistry.registerTypeDefinition(enriched)) {
    spec.types?.push(enriched);
  }
}

function applyPresentationDefaults<
  T extends {
    name: string;
    kind?: string;
    slug?: string;
    displayName?: string;
    category?: string;
    importPath?: string;
    source?: { file?: string };
  },
>(entry: T, baseDir: string): T {
  const slug = entry.slug ?? createSlug(entry.name);
  const displayName = entry.displayName ?? entry.name;
  const category = entry.category ?? entry.kind;
  const importPath = entry.importPath ?? deriveImportPath(entry.source?.file, baseDir);

  return {
    ...entry,
    ...(slug ? { slug } : {}),
    ...(displayName ? { displayName } : {}),
    ...(category ? { category } : {}),
    ...(importPath ? { importPath } : {}),
  };
}

/**
 * Create a URL-safe slug from an export name.
 * Handles unicode identifiers and avoids collisions.
 *
 * @param name - The export name
 * @param existingSlugs - Set of already-used slugs for collision detection
 * @returns A unique, URL-safe slug
 */
function createSlug(name: string, existingSlugs?: Set<string>): string {
  // Transliterate common unicode chars to ASCII equivalents
  let normalized = name
    // Common unicode replacements
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    // Greek letters (commonly used in math/science)
    .replace(/α/g, 'alpha')
    .replace(/β/g, 'beta')
    .replace(/γ/g, 'gamma')
    .replace(/δ/g, 'delta')
    .replace(/λ/g, 'lambda')
    .replace(/μ/g, 'mu')
    .replace(/π/g, 'pi')
    .replace(/σ/g, 'sigma')
    .replace(/Σ/g, 'sigma')
    // Convert camelCase/PascalCase to kebab-case
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove any remaining non-alphanumeric chars (except hyphen)
    .replace(/[^a-zA-Z0-9-]/g, '')
    // Collapse multiple hyphens
    .replace(/--+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  // Fallback for empty result
  if (!normalized) {
    normalized = 'export';
  }

  // Handle collisions by appending a suffix
  if (existingSlugs) {
    let finalSlug = normalized;
    let counter = 1;
    while (existingSlugs.has(finalSlug)) {
      finalSlug = `${normalized}-${counter}`;
      counter++;
    }
    existingSlugs.add(finalSlug);
    return finalSlug;
  }

  return normalized;
}

/**
 * Strip TypeScript/JavaScript file extensions from a path.
 * Handles multi-dot extensions like .d.ts, .d.mts, .d.cts properly.
 */
function stripExtensions(filePath: string): string {
  // Order matters: check multi-part extensions first
  const extensions = [
    '.d.ts',
    '.d.mts',
    '.d.cts',
    '.tsx',
    '.ts',
    '.jsx',
    '.js',
    '.mts',
    '.cts',
    '.mjs',
    '.cjs',
  ];

  for (const ext of extensions) {
    if (filePath.endsWith(ext)) {
      return filePath.slice(0, -ext.length);
    }
  }

  return filePath;
}

function deriveImportPath(sourceFile: string | undefined, baseDir: string): string | undefined {
  if (!sourceFile) {
    return undefined;
  }

  const relative = path.relative(baseDir, sourceFile);
  if (!relative || relative.startsWith('..')) {
    return undefined;
  }

  const normalized = relative.replace(/\\/g, '/');
  const withoutExt = stripExtensions(normalized);
  if (!withoutExt) {
    return undefined;
  }

  const prefixed = withoutExt.startsWith('.') ? withoutExt : `./${withoutExt}`;
  return prefixed.replace(/\/\/+/, '/');
}

/**
 * Follows export aliases back to the declaration that carries the type
 * information we need to serialize.
 */
function resolveExportTarget(
  symbol: TS.Symbol,
  checker: TS.TypeChecker,
): {
  declaration?: TS.Declaration;
  targetSymbol: TS.Symbol;
} {
  let targetSymbol = symbol;

  // Use getAliasedSymbol to follow the full alias chain (handles re-exports)
  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliasTarget = checker.getAliasedSymbol(symbol);
    if (aliasTarget && aliasTarget !== symbol) {
      targetSymbol = aliasTarget;
    }
  }

  const declarations = targetSymbol.declarations ?? [];
  const declaration =
    targetSymbol.valueDeclaration ||
    declarations.find((decl) => decl.kind !== ts.SyntaxKind.ExportSpecifier) ||
    declarations[0];

  return {
    declaration,
    targetSymbol,
  };
}

/**
 * When a symbol is re-exported under a different name, rewrite the serialized
 * entry so it reflects the public export name without losing the captured
 * metadata.
 */
function withExportName<T extends { id: string; name: string; alias?: string }>(
  entry: T,
  exportName: string,
): T {
  if (entry.name === exportName) {
    return entry;
  }

  // Keep original name (matches source), use alias for the public/exported name
  return {
    ...entry,
    id: exportName,
    // Keep original name (matches source file)
    name: entry.name,
    // Add alias to indicate re-export
    alias: exportName,
  };
}
