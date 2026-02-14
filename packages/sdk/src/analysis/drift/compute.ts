import type { ApiExport, ApiSpec } from '../api-spec';
import type { ModuleGraph } from '../module-graph';
import { detectAllExampleIssues } from './example-drift';
import { detectOptionalityDrift, detectParamDrift, detectParamTypeDrift } from './param-drift';
import {
  detectAsyncMismatch,
  detectBrokenLinks,
  detectDeprecatedDrift,
  detectVisibilityDrift,
} from './semantic-drift';
import {
  detectGenericConstraintDrift,
  detectPropertyTypeDrift,
  detectReturnTypeDrift,
} from './type-drift';
import type { DriftResult, ExportInfo, ExportRegistry, SpecDocDrift } from './types';

/**
 * Options for computing drift.
 */
export interface ComputeDriftOptions {
  /**
   * Module graph for cross-module @link validation.
   * When provided, @link targets are validated across all modules.
   */
  moduleGraph?: ModuleGraph;
}

/**
 * Build a registry of all export/type names for cross-reference validation.
 */
export function buildExportRegistry(spec: ApiSpec): ExportRegistry {
  const exports = new Map<string, ExportInfo>();
  const types = new Set<string>();
  const all = new Set<string>();

  for (const entry of spec.exports ?? []) {
    const info: ExportInfo = {
      name: entry.name,
      kind: entry.kind ?? 'unknown',
      isCallable: ['function', 'class'].includes(entry.kind ?? ''),
    };
    exports.set(entry.name, info);
    if (entry.id) exports.set(entry.id, info);
    all.add(entry.name);
    if (entry.id) all.add(entry.id);

    // Include namespace members in registry
    if (entry.kind === 'namespace' && entry.members) {
      for (const member of entry.members) {
        if (!member.name) continue;
        const memberInfo: ExportInfo = {
          name: member.name,
          kind: member.kind ?? 'unknown',
          isCallable: ['function', 'class'].includes(member.kind ?? ''),
        };
        exports.set(member.name, memberInfo);
        all.add(member.name);
      }
    }
  }

  for (const type of spec.types ?? []) {
    types.add(type.name);
    if (type.id) types.add(type.id);
    all.add(type.name);
    if (type.id) all.add(type.id);
  }

  // Build type member index: memberName → Set<parentTypeName>
  const typeMembers = new Map<string, Set<string>>();

  const indexMembers = (typeName: string, schema: Record<string, unknown> | undefined) => {
    const props = (schema as { properties?: Record<string, unknown> })?.properties;
    if (!props) return;
    for (const memberName of Object.keys(props)) {
      let parents = typeMembers.get(memberName);
      if (!parents) {
        parents = new Set();
        typeMembers.set(memberName, parents);
      }
      parents.add(typeName);
    }
  };

  // Index members from exported types (class, interface, type with properties)
  for (const entry of spec.exports ?? []) {
    indexMembers(entry.name, entry.schema as Record<string, unknown>);
    // Also index from explicit members array
    if (entry.members) {
      for (const member of entry.members) {
        if (!member.name) continue;
        let parents = typeMembers.get(member.name);
        if (!parents) {
          parents = new Set();
          typeMembers.set(member.name, parents);
        }
        parents.add(entry.name);
      }
    }
  }

  // Index members from referenced types (e.g. Simnet in types[])
  for (const type of spec.types ?? []) {
    indexMembers(type.name, type.schema as Record<string, unknown>);
    if (type.members) {
      for (const member of type.members) {
        if (!member.name) continue;
        let parents = typeMembers.get(member.name);
        if (!parents) {
          parents = new Set();
          typeMembers.set(member.name, parents);
        }
        parents.add(type.name);
      }
    }
  }

  // Pre-compute candidate lists for fuzzy matching (performance optimization)
  const callableNames = Array.from(exports.values())
    .filter((e) => e.isCallable)
    .map((e) => e.name);

  const typeKinds = new Set(['class', 'interface', 'type', 'enum']);
  const typeNames = [
    ...Array.from(types),
    ...Array.from(exports.values())
      .filter((e) => typeKinds.has(e.kind))
      .map((e) => e.name),
  ];

  const allExportNames = Array.from(exports.keys());
  const allNames = Array.from(all);
  const allMemberNames = Array.from(typeMembers.keys());

  return { exports, types, all, callableNames, typeNames, allExportNames, allNames, typeMembers, allMemberNames };
}

/**
 * Compute drift for all exports in a spec.
 *
 * @param spec - The OpenPkg spec to analyze
 * @param [options] - Optional config including moduleGraph for cross-module validation
 * @returns Drift results per export
 */
export function computeDrift(spec: ApiSpec, options?: ComputeDriftOptions): DriftResult {
  const registry = buildExportRegistry(spec);
  const exports = new Map<string, SpecDocDrift[]>();

  for (const entry of spec.exports ?? []) {
    const drift = computeExportDrift(entry, registry, options);
    exports.set(entry.id ?? entry.name, drift);
  }

  return { exports };
}

/**
 * Compute drift for a single export.
 *
 * @param entry - The export to analyze
 * @param [registry] - Registry of known exports and types for validation
 * @param [options] - Optional config including moduleGraph for cross-module validation
 * @returns Array of drift issues detected
 */
export function computeExportDrift(
  entry: ApiExport,
  registry?: ExportRegistry,
  options?: ComputeDriftOptions,
): SpecDocDrift[] {
  // Early exit - no docs means no drift possible
  const hasDescription = Boolean(entry.description);
  const hasTags = (entry.tags?.length ?? 0) > 0;
  const hasExamples = (entry.examples?.length ?? 0) > 0;

  if (!hasDescription && !hasTags && !hasExamples) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  // Only run tag-related detectors if tags exist
  if (hasTags) {
    drifts.push(
      ...detectParamDrift(entry),
      ...detectOptionalityDrift(entry),
      ...detectParamTypeDrift(entry),
      ...detectReturnTypeDrift(entry),
      ...detectGenericConstraintDrift(entry),
      ...detectDeprecatedDrift(entry),
      ...detectVisibilityDrift(entry),
      ...detectAsyncMismatch(entry),
      ...detectPropertyTypeDrift(entry),
    );
  }

  // Only run example detectors if examples exist (combined function parses AST once)
  if (hasExamples) {
    drifts.push(...detectAllExampleIssues(entry, registry));
  }

  // Broken links can be in description or tags
  if (hasDescription || hasTags) {
    drifts.push(...detectBrokenLinks(entry, registry, { moduleGraph: options?.moduleGraph }));
  }

  // Stamp source location from the entry onto all drifts that don't already have one
  const filePath = entry.source?.file;
  const line = entry.source?.line;
  if (filePath) {
    for (const d of drifts) {
      if (!d.filePath) d.filePath = filePath;
      if (!d.line && line) d.line = line;
    }
  }

  return drifts;
}
