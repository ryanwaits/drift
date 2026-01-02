'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import Link from 'next/link';

export interface ExportCardProps {
  /** Function/export name */
  name: string;
  /** Description snippet */
  description?: string;
  /** Link to detail page */
  href: string;
  /** Export kind: function, type, variable, class, interface, enum */
  kind?: 'function' | 'type' | 'variable' | 'class' | 'interface' | 'enum';
  /** Custom className */
  className?: string;
}

const KIND_COLORS: Record<ExportCardProps['kind'] & string, string> = {
  function: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
  class: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
  interface: 'group-hover:text-green-600 dark:group-hover:text-green-400',
  type: 'group-hover:text-amber-600 dark:group-hover:text-amber-400',
  enum: 'group-hover:text-rose-600 dark:group-hover:text-rose-400',
  variable: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
};

const KIND_BADGE_COLORS: Record<ExportCardProps['kind'] & string, string> = {
  function: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  class: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  interface: 'bg-green-500/10 text-green-600 dark:text-green-400',
  type: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  enum: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  variable: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
};

/**
 * Card component for displaying exports in an index grid.
 * Features function name styling, description, and hover effects.
 */
export function ExportCard({
  name,
  description,
  href,
  kind = 'function',
  className,
}: ExportCardProps): React.ReactNode {
  const isFunction = kind === 'function';
  const hoverColor = KIND_COLORS[kind];
  const badgeColor = KIND_BADGE_COLORS[kind];

  return (
    <Link
      href={href}
      className={cn(
        'group block rounded-lg border border-border bg-card/50 p-4',
        'transition-all duration-200 ease-out',
        'hover:border-primary/30 hover:bg-card hover:shadow-lg hover:shadow-primary/5',
        'hover:-translate-y-1',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'font-mono text-base font-medium text-foreground transition-colors duration-200',
            hoverColor,
          )}
        >
          {name}
        </span>
        {isFunction && <span className="font-mono text-base text-muted-foreground">()</span>}
        <span className={cn('ml-auto text-xs px-2 py-0.5 rounded-full font-medium', badgeColor)}>
          {kind}
        </span>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed group-hover:text-muted-foreground/80 transition-colors">
          {description}
        </p>
      )}
    </Link>
  );
}
