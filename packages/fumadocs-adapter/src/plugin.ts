import type { SpecExportKind } from '@openpkg-ts/doc-generator';
import type { Item } from 'fumadocs-core/page-tree';
import type { LoaderPlugin } from 'fumadocs-core/source';
import { createElement } from 'react';
import { SidebarKindBadge } from './components/sidebar-badge';
import type { OpenPkgPageData } from './source';

// Re-export for backward compatibility
export {
  SidebarKindBadge as KindBadge,
  type SidebarKindBadgeProps as KindBadgeProps,
} from './components/sidebar-badge';

const SUPPORTED_KINDS = new Set<string>([
  'function',
  'class',
  'interface',
  'type',
  'enum',
  'variable',
  'namespace',
  'module',
  'reference',
  'external',
]);

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
        if (!kind || !SUPPORTED_KINDS.has(kind)) return node;

        // Add badge as icon instead of modifying name
        const badge = createElement(SidebarKindBadge, { kind });

        return { ...node, icon: badge };
      },
    },
  };
}
