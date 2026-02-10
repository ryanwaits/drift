import type { OpenPkg } from '@openpkg-ts/spec';

/**
 * Information about a module in the graph.
 */
export interface ModuleInfo {
  /**
   * Module name (package name).
   */
  name: string;

  /**
   * Set of exported symbol names from this module.
   */
  exports: Set<string>;

  /**
   * Set of type names exported from this module.
   */
  types: Set<string>;
}

/**
 * Graph of modules and their exported symbols for cross-module validation.
 */
export interface ModuleGraph {
  /**
   * Map of module names to their info.
   */
  modules: Map<string, ModuleInfo>;

  /**
   * Map of symbol names to the module that exports them.
   * For symbols exported from multiple modules, contains the first found.
   */
  exports: Map<string, string>;

  /**
   * Map of type names to the module that exports them.
   */
  types: Map<string, string>;

  /**
   * Combined set of all exported symbol and type names across all modules.
   */
  all: Set<string>;
}

/**
 * Build a module graph from multiple OpenPkg specs.
 *
 * Used for cross-module @link validation in batch mode.
 *
 * @param specs - Array of OpenPkg specs to build graph from
 * @returns ModuleGraph for cross-module symbol lookup
 *
 * @example
 * ```ts
 * import { buildModuleGraph } from '@driftdev/sdk';
 *
 * const graph = buildModuleGraph([pkg1Spec, pkg2Spec]);
 *
 * // Check if symbol exists in any module
 * if (graph.all.has('Schedule')) {
 *   console.log(`Schedule is exported from: ${graph.exports.get('Schedule')}`);
 * }
 * ```
 */
export function buildModuleGraph(specs: OpenPkg[]): ModuleGraph {
  const modules = new Map<string, ModuleInfo>();
  const exports = new Map<string, string>();
  const types = new Map<string, string>();
  const all = new Set<string>();

  for (const spec of specs) {
    const moduleName = spec.meta.name;
    const moduleExports = new Set<string>();
    const moduleTypes = new Set<string>();

    // Collect exports
    for (const exp of spec.exports ?? []) {
      moduleExports.add(exp.name);
      all.add(exp.name);

      if (exp.id) {
        moduleExports.add(exp.id);
        all.add(exp.id);
      }

      // First module to export wins
      if (!exports.has(exp.name)) {
        exports.set(exp.name, moduleName);
      }

      // Namespace members
      if (exp.kind === 'namespace' && exp.members) {
        for (const member of exp.members) {
          if (!member.name) continue;
          moduleExports.add(member.name);
          all.add(member.name);
          if (!exports.has(member.name)) {
            exports.set(member.name, moduleName);
          }
        }
      }
    }

    // Collect types
    for (const type of spec.types ?? []) {
      moduleTypes.add(type.name);
      all.add(type.name);

      if (type.id) {
        moduleTypes.add(type.id);
        all.add(type.id);
      }

      if (!types.has(type.name)) {
        types.set(type.name, moduleName);
      }
    }

    modules.set(moduleName, {
      name: moduleName,
      exports: moduleExports,
      types: moduleTypes,
    });
  }

  return { modules, exports, types, all };
}

/**
 * Check if a symbol exists in the module graph.
 *
 * @param graph - Module graph to search
 * @param symbol - Symbol name to find
 * @returns Module name if found, undefined otherwise
 */
export function findSymbolModule(graph: ModuleGraph, symbol: string): string | undefined {
  return graph.exports.get(symbol) ?? graph.types.get(symbol);
}

/**
 * Check if a symbol exists anywhere in the module graph.
 *
 * @param graph - Module graph to search
 * @param symbol - Symbol name to check
 * @returns true if symbol exists in any module
 */
export function symbolExistsInGraph(graph: ModuleGraph, symbol: string): boolean {
  return graph.all.has(symbol);
}
