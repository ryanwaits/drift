import { KindBadge as UIKindBadge } from '@doccov/ui/badge';
import type { SpecExportKind } from '@openpkg-ts/doc-generator';
import { createElement, type ReactNode } from 'react';

// Map doc-generator kinds to @doccov/ui badge kinds
// The UI badge uses lowercase strings that match CVA variants
type UIBadgeKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'namespace'
  | 'module'
  | 'reference'
  | 'external';

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
 * Wraps @doccov/ui KindBadge with size="sm" for sidebar use.
 *
 * Uses createElement instead of JSX for compatibility with
 * fumadocs transformPageTree server context.
 */
export function SidebarKindBadge({ kind, className }: SidebarKindBadgeProps): ReactNode {
  if (!SUPPORTED_KINDS.has(kind)) return null;

  return createElement(UIKindBadge, {
    kind: kind as UIBadgeKind,
    size: 'sm',
    className,
  });
}
