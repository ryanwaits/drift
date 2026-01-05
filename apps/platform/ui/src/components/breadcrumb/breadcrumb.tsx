'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';

interface BreadcrumbItem {
  id: string;
  label: string;
  truncate?: boolean;
  maxWidth?: number;
  hasDropdown?: boolean;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}

const Breadcrumb: React.ForwardRefExoticComponent<
  BreadcrumbProps & React.RefAttributes<HTMLDivElement>
> = React.forwardRef<HTMLDivElement, BreadcrumbProps>(
  ({ items, separator = '/', className }, ref) => {
    return (
      <nav
        ref={ref}
        className={cn('flex items-center gap-2 text-sm', className)}
        aria-label="Breadcrumb"
      >
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 && <span className="text-muted-foreground/50 select-none">{separator}</span>}
            <BreadcrumbItemButton item={item} />
          </React.Fragment>
        ))}
      </nav>
    );
  },
);
Breadcrumb.displayName = 'Breadcrumb';

function BreadcrumbItemButton({ item }: { item: BreadcrumbItem }) {
  const { label, truncate, maxWidth = 200, hasDropdown, onClick } = item;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 font-medium text-foreground hover:text-foreground/80 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded',
        !onClick && 'cursor-default',
      )}
    >
      <span
        className={cn(truncate && 'truncate')}
        style={truncate ? { maxWidth } : undefined}
        title={truncate ? label : undefined}
      >
        {label}
      </span>
      {hasDropdown && <ChevronDown className="size-4 text-muted-foreground" />}
    </button>
  );
}

// Standalone dropdown trigger for use in navigation
interface BreadcrumbDropdownProps {
  label: string;
  truncate?: boolean;
  maxWidth?: number;
  className?: string;
  onClick?: () => void;
}

const BreadcrumbDropdown: React.ForwardRefExoticComponent<
  BreadcrumbDropdownProps & React.RefAttributes<HTMLButtonElement>
> = React.forwardRef<HTMLButtonElement, BreadcrumbDropdownProps>(
  ({ label, truncate, maxWidth = 200, className, onClick }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={cn(
          'flex items-center gap-1 font-medium text-foreground hover:text-foreground/80 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-1 -mx-1',
          className,
        )}
      >
        <span
          className={cn(truncate && 'truncate')}
          style={truncate ? { maxWidth } : undefined}
          title={truncate ? label : undefined}
        >
          {label}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
    );
  },
);
BreadcrumbDropdown.displayName = 'BreadcrumbDropdown';

export {
  Breadcrumb,
  BreadcrumbDropdown,
  type BreadcrumbItem,
  type BreadcrumbProps,
  type BreadcrumbDropdownProps,
};
