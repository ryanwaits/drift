'use client';

import { cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type ExportKind = 'function' | 'type' | 'variable' | 'class' | 'interface' | 'enum';

/**
 * Kind badge variants for export cards.
 */
const kindBadgeVariants: (props?: { kind?: ExportKind | null; className?: string }) => string = cva(
  'inline-flex items-center justify-center font-mono font-medium rounded shrink-0 h-5 px-1.5 text-xs',
  {
    variants: {
      kind: {
        function: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400',
        class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        interface: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
        type: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
        enum: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        variable: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
      },
    },
    defaultVariants: {
      kind: 'function',
    },
  },
);

const kindLabels: Record<ExportKind, string> = {
  function: 'fn',
  class: 'cls',
  interface: 'int',
  type: 'type',
  enum: 'enum',
  variable: 'var',
};

export interface ExportCardProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Export name */
  name: string;
  /** Description snippet */
  description?: string;
  /** Link to detail page */
  href: string;
  /** Export kind */
  kind?: ExportKind | null;
  /** Custom link component (for Next.js Link) */
  as?: React.ElementType;
}

/**
 * Card component for displaying exports in an index grid.
 * Features function name styling, description, kind badge, and hover effects.
 */
export const ExportCard: React.ForwardRefExoticComponent<
  ExportCardProps & React.RefAttributes<HTMLAnchorElement>
> = React.forwardRef<HTMLAnchorElement, ExportCardProps>(
  (
    { name, description, href, kind = 'function', as: Component = 'a', className, ...props },
    ref,
  ) => {
    const isFunction = kind === 'function';

    return (
      <Component
        ref={ref}
        href={href}
        className={cn(
          'group block rounded-lg border border-border bg-card/50 p-4',
          'transition-all duration-200',
          'hover:border-border/80 hover:bg-card hover:shadow-md',
          'hover:-translate-y-0.5',
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className={kindBadgeVariants({ kind })}>{kindLabels[kind]}</span>
          <span className="font-mono text-base font-medium text-foreground group-hover:text-primary transition-colors">
            {name}
          </span>
          {isFunction && <span className="font-mono text-base text-muted-foreground">()</span>}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </Component>
    );
  },
);
ExportCard.displayName = 'ExportCard';

export { kindBadgeVariants };
