import type { SpecExport } from '@openpkg-ts/spec';
import type { OpenPkgSpec } from '../spec-types';
import { detectExampleDrift, detectExampleSyntaxErrors } from './example-drift';
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
 * Build a registry of all export/type names for cross-reference validation.
 */
export function buildExportRegistry(spec: OpenPkgSpec): ExportRegistry {
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

  return { exports, types, all };
}

/**
 * Compute drift for all exports in a spec.
 *
 * @param spec - The OpenPkg spec to analyze
 * @returns Drift results per export
 */
export function computeDrift(spec: OpenPkgSpec): DriftResult {
  const registry = buildExportRegistry(spec);
  const exports = new Map<string, SpecDocDrift[]>();

  for (const entry of spec.exports ?? []) {
    const drift = computeExportDrift(entry, registry);
    exports.set(entry.id ?? entry.name, drift);
  }

  return { exports };
}

/**
 * Compute drift for a single export.
 *
 * @param entry - The export to analyze
 * @param registry - Registry of known exports and types for validation
 * @returns Array of drift issues detected
 */
export function computeExportDrift(entry: SpecExport, registry?: ExportRegistry): SpecDocDrift[] {
  return [
    ...detectParamDrift(entry),
    ...detectOptionalityDrift(entry),
    ...detectParamTypeDrift(entry),
    ...detectReturnTypeDrift(entry),
    ...detectGenericConstraintDrift(entry),
    ...detectDeprecatedDrift(entry),
    ...detectVisibilityDrift(entry),
    ...detectExampleDrift(entry, registry),
    ...detectBrokenLinks(entry, registry),
    ...detectExampleSyntaxErrors(entry),
    ...detectAsyncMismatch(entry),
    ...detectPropertyTypeDrift(entry),
  ];
}
