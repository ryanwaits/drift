import type { LoaderPlugin } from 'fumadocs-core/source';
import type { Item } from 'fumadocs-core/page-tree';
import type { SpecExportKind } from '@openpkg-ts/doc-generator';
import type { OpenPkgPageData } from './source';
import { createElement, type ReactNode } from 'react';

const KIND_BADGES: Partial<Record<SpecExportKind, { label: string; className: string }>> = {
  function: { label: 'fn', className: 'openpkg-badge-function' },
  class: { label: 'C', className: 'openpkg-badge-class' },
  interface: { label: 'I', className: 'openpkg-badge-interface' },
  type: { label: 'T', className: 'openpkg-badge-type' },
  enum: { label: 'E', className: 'openpkg-badge-enum' },
  variable: { label: 'V', className: 'openpkg-badge-variable' },
  namespace: { label: 'N', className: 'openpkg-badge-namespace' },
  module: { label: 'M', className: 'openpkg-badge-module' },
  reference: { label: 'R', className: 'openpkg-badge-reference' },
  external: { label: 'X', className: 'openpkg-badge-external' },
};

export interface KindBadgeProps {
  kind: SpecExportKind;
  className?: string;
}

/**
 * Badge component to display export kind in sidebar.
 */
export function KindBadge({ kind, className }: KindBadgeProps): ReactNode {
  const badge = KIND_BADGES[kind];
  if (!badge) return null;

  return createElement(
    'span',
    {
      className: `openpkg-kind-badge ${badge.className} ${className || ''}`.trim(),
      'data-kind': kind,
    },
    badge.label
  );
}

export interface OpenpkgPluginOptions {
  /** Show kind badges in sidebar (default: true) */
  showBadges?: boolean;
}

/**
 * Fumadocs loader plugin that enhances page tree nodes with kind badges.
 *
 * @example
 * ```ts
 * import { loader } from 'fumadocs-core/source';
 * import { openpkgSource, openpkgPlugin } from '@openpkg-ts/fumadocs-adapter';
 * import spec from './openpkg.json';
 *
 * export const source = loader({
 *   baseUrl: '/docs/api',
 *   source: openpkgSource({ spec }),
 *   plugins: [openpkgPlugin()],
 * });
 * ```
 */
export function openpkgPlugin(options: OpenpkgPluginOptions = {}): LoaderPlugin {
  const { showBadges = true } = options;

  return {
    name: 'openpkg',
    transformPageTree: {
      file(node: Item, filePath?: string): Item {
        if (!showBadges || !filePath) return node;

        // Read the original file data from storage
        const file = this.storage.read(filePath);
        if (!file || file.format !== 'page') return node;

        const pageData = file.data as OpenPkgPageData;
        const kind = pageData.export?.kind as SpecExportKind | undefined;
        if (!kind || !KIND_BADGES[kind]) return node;

        // Add badge to node name
        const badge = createElement(KindBadge, { kind, key: 'badge' });
        const name =
          typeof node.name === 'string'
            ? createElement('span', { key: 'name' }, node.name)
            : node.name;
        const newName = createElement(
          'span',
          { className: 'openpkg-sidebar-item' },
          badge,
          name
        );

        return { ...node, name: newName };
      },
    },
  };
}
