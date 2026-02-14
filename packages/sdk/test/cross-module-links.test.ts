/**
 * Tests for cross-module @link validation.
 */

import type { ApiExport, ApiSpec } from '../src/analysis/api-spec';
import { describe, expect, it } from 'vitest';
import { detectBrokenLinks } from '../src/analysis/drift';
import type { ExportRegistry } from '../src/analysis/drift/types';
import {
  buildModuleGraph,
  findSymbolModule,
  symbolExistsInGraph,
} from '../src/analysis/module-graph';

function createExport(overrides: Partial<ApiExport>): ApiExport {
  return {
    id: 'test',
    name: 'test',
    kind: 'function',
    ...overrides,
  };
}

function createSpec(
  name: string,
  exports: ApiExport[],
  types: { name: string; id?: string }[] = [],
): ApiSpec {
  return {
    meta: { name, version: '1.0.0' },
    exports,
    types: types as ApiSpec['types'],
  };
}

function createRegistry(exportNames: string[], typeNames: string[] = []): ExportRegistry {
  const exports = new Map(
    exportNames.map((name) => [name, { name, kind: 'function', isCallable: true }]),
  );
  const types = new Set(typeNames);
  const all = new Set([...exportNames, ...typeNames]);

  return {
    exports,
    types,
    all,
    callableNames: exportNames,
    typeNames,
    allExportNames: exportNames,
    allNames: [...exportNames, ...typeNames],
  };
}

describe('buildModuleGraph', () => {
  it('builds graph from multiple specs', () => {
    const spec1 = createSpec('pkg-a', [
      createExport({ name: 'foo', id: 'foo' }),
      createExport({ name: 'bar', id: 'bar' }),
    ]);
    const spec2 = createSpec('pkg-b', [
      createExport({ name: 'Schedule', id: 'Schedule' }),
      createExport({ name: 'Effect', id: 'Effect' }),
    ]);

    const graph = buildModuleGraph([spec1, spec2]);

    expect(graph.all.has('foo')).toBe(true);
    expect(graph.all.has('bar')).toBe(true);
    expect(graph.all.has('Schedule')).toBe(true);
    expect(graph.all.has('Effect')).toBe(true);
  });

  it('tracks which module exports each symbol', () => {
    const spec1 = createSpec('core', [createExport({ name: 'CoreFn' })]);
    const spec2 = createSpec('utils', [createExport({ name: 'UtilFn' })]);

    const graph = buildModuleGraph([spec1, spec2]);

    expect(graph.exports.get('CoreFn')).toBe('core');
    expect(graph.exports.get('UtilFn')).toBe('utils');
  });

  it('includes types in graph', () => {
    const spec = createSpec(
      'types-pkg',
      [createExport({ name: 'createConfig' })],
      [{ name: 'Config' }, { name: 'Options' }],
    );

    const graph = buildModuleGraph([spec]);

    expect(graph.all.has('Config')).toBe(true);
    expect(graph.all.has('Options')).toBe(true);
    expect(graph.types.get('Config')).toBe('types-pkg');
  });

  it('includes namespace members', () => {
    const spec = createSpec('ns-pkg', [
      createExport({
        name: 'Utils',
        kind: 'namespace',
        members: [
          { name: 'helper', kind: 'function' },
          { name: 'format', kind: 'function' },
        ],
      }),
    ]);

    const graph = buildModuleGraph([spec]);

    expect(graph.all.has('Utils')).toBe(true);
    expect(graph.all.has('helper')).toBe(true);
    expect(graph.all.has('format')).toBe(true);
  });
});

describe('findSymbolModule', () => {
  it('finds module for export', () => {
    const graph = buildModuleGraph([
      createSpec('pkg-a', [createExport({ name: 'fnA' })]),
      createSpec('pkg-b', [createExport({ name: 'fnB' })]),
    ]);

    expect(findSymbolModule(graph, 'fnA')).toBe('pkg-a');
    expect(findSymbolModule(graph, 'fnB')).toBe('pkg-b');
  });

  it('finds module for type', () => {
    const graph = buildModuleGraph([createSpec('types', [], [{ name: 'MyType' }])]);

    expect(findSymbolModule(graph, 'MyType')).toBe('types');
  });

  it('returns undefined for unknown symbol', () => {
    const graph = buildModuleGraph([createSpec('pkg', [])]);

    expect(findSymbolModule(graph, 'unknown')).toBeUndefined();
  });
});

describe('symbolExistsInGraph', () => {
  it('returns true for existing symbol', () => {
    const graph = buildModuleGraph([createSpec('pkg', [createExport({ name: 'exists' })])]);

    expect(symbolExistsInGraph(graph, 'exists')).toBe(true);
  });

  it('returns false for non-existing symbol', () => {
    const graph = buildModuleGraph([createSpec('pkg', [])]);

    expect(symbolExistsInGraph(graph, 'missing')).toBe(false);
  });
});

describe('detectBrokenLinks with moduleGraph', () => {
  it('reports broken link when symbol not in current module', () => {
    const entry = createExport({
      description: 'Uses {@link Schedule} for timing',
    });
    const registry = createRegistry(['foo', 'bar']);

    const drifts = detectBrokenLinks(entry, registry);

    expect(drifts).toHaveLength(1);
    expect(drifts[0].type).toBe('broken-link');
    expect(drifts[0].target).toBe('Schedule');
  });

  it('does not report when symbol exists in moduleGraph', () => {
    const entry = createExport({
      description: 'Uses {@link Schedule} for timing',
    });
    const registry = createRegistry(['foo', 'bar']);
    const moduleGraph = buildModuleGraph([
      createSpec('scheduler', [createExport({ name: 'Schedule' })]),
    ]);

    const drifts = detectBrokenLinks(entry, registry, { moduleGraph });

    expect(drifts).toHaveLength(0);
  });

  it('validates @see references cross-module', () => {
    const entry = createExport({
      description: 'Related to {@see Effect}',
    });
    const registry = createRegistry(['localFn']);
    const moduleGraph = buildModuleGraph([
      createSpec('effect', [createExport({ name: 'Effect' })]),
    ]);

    const drifts = detectBrokenLinks(entry, registry, { moduleGraph });

    expect(drifts).toHaveLength(0);
  });

  it('validates @inheritDoc references cross-module', () => {
    const entry = createExport({
      description: 'Docs: {@inheritDoc BaseClass}',
    });
    const registry = createRegistry(['ChildClass']);
    const moduleGraph = buildModuleGraph([
      createSpec('base', [createExport({ name: 'BaseClass', kind: 'class' })]),
    ]);

    const drifts = detectBrokenLinks(entry, registry, { moduleGraph });

    expect(drifts).toHaveLength(0);
  });

  it('still reports broken link when not in moduleGraph either', () => {
    const entry = createExport({
      description: 'Uses {@link NonExistent}',
    });
    const registry = createRegistry(['localFn']);
    const moduleGraph = buildModuleGraph([createSpec('pkg', [createExport({ name: 'OtherFn' })])]);

    const drifts = detectBrokenLinks(entry, registry, { moduleGraph });

    expect(drifts).toHaveLength(1);
    expect(drifts[0].target).toBe('NonExistent');
  });

  it('handles qualified names (Foo.bar)', () => {
    const entry = createExport({
      description: 'Uses {@link Utils.helper}',
    });
    const registry = createRegistry([]);
    const moduleGraph = buildModuleGraph([
      createSpec('utils-pkg', [createExport({ name: 'Utils' })]),
    ]);

    const drifts = detectBrokenLinks(entry, registry, { moduleGraph });

    // Should not report - Utils exists in graph
    expect(drifts).toHaveLength(0);
  });

  it('validates types in moduleGraph', () => {
    const entry = createExport({
      description: 'Returns {@link Config} object',
    });
    const registry = createRegistry(['createConfig']);
    const moduleGraph = buildModuleGraph([createSpec('config', [], [{ name: 'Config' }])]);

    const drifts = detectBrokenLinks(entry, registry, { moduleGraph });

    expect(drifts).toHaveLength(0);
  });

  it('validates @link with label syntax', () => {
    const entry = createExport({
      description: 'See {@link Schedule | the scheduler} for details',
    });
    const registry = createRegistry([]);
    const moduleGraph = buildModuleGraph([
      createSpec('scheduler', [createExport({ name: 'Schedule' })]),
    ]);

    const drifts = detectBrokenLinks(entry, registry, { moduleGraph });

    expect(drifts).toHaveLength(0);
  });

  it('prefers current module registry over moduleGraph', () => {
    const entry = createExport({
      description: 'Uses {@link localFn}',
    });
    const registry = createRegistry(['localFn']);
    // moduleGraph doesn't have it, but registry does
    const moduleGraph = buildModuleGraph([createSpec('other', [])]);

    const drifts = detectBrokenLinks(entry, registry, { moduleGraph });

    expect(drifts).toHaveLength(0);
  });
});

describe('integration: Effect library example', () => {
  it('validates cross-module references like Effect -> Schedule', () => {
    // Simulates Effect library structure where Effect.ts references Schedule from Schedule.ts
    const effectEntry = createExport({
      name: 'effect',
      description: 'Main effect function. Uses {@link Schedule} for timing operations.',
    });

    // Registry for current module (Effect.ts) - doesn't have Schedule
    const effectRegistry = createRegistry(['effect', 'runEffect', 'pipe']);

    // Module graph includes all modules
    const graph = buildModuleGraph([
      createSpec('effect', [
        createExport({ name: 'effect' }),
        createExport({ name: 'runEffect' }),
        createExport({ name: 'pipe' }),
      ]),
      createSpec('schedule', [
        createExport({ name: 'Schedule' }),
        createExport({ name: 'once' }),
        createExport({ name: 'forever' }),
      ]),
    ]);

    const drifts = detectBrokenLinks(effectEntry, effectRegistry, { moduleGraph: graph });

    // Should NOT report Schedule as broken - it exists in the schedule module
    expect(drifts).toHaveLength(0);
  });
});
