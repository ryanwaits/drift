import type { SpecExportKind } from '@openpkg-ts/doc-generator';
import { type KindBadgeKind, KindBadge as UIKindBadge } from '@openpkg-ts/ui/badge';
import { createElement, type ReactNode } from 'react';

const SUPPORTED_KINDS: Set<string> = new Set([
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

export interface SidebarKindBadgeProps {
  kind: SpecExportKind;
  className?: string;
}

/**
 * Sidebar badge component for fumadocs page tree.
 * Wraps @openpkg-ts/ui KindBadge with size="sm" for sidebar use.
 *
 * Uses createElement instead of JSX for compatibility with
 * fumadocs transformPageTree server context.
 */
export function SidebarKindBadge({ kind, className }: SidebarKindBadgeProps): ReactNode {
  if (!SUPPORTED_KINDS.has(kind)) return null;

  return createElement(UIKindBadge, {
    kind: kind as KindBadgeKind,
    size: 'sm',
    className,
  });
}
