'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';
import { cn } from '../../../lib/utils';

export interface ParameterListProps {
  /** Title above the list (e.g., "Body parameters") */
  title?: string;
  /** Number of items to show before collapsing */
  collapseAfter?: number;
  /** Child parameter items */
  children: React.ReactNode;
  /** Custom className */
  className?: string;
}

/**
 * Container for parameter items with optional "More parameters" collapse.
 */
export function ParameterList({
  title,
  collapseAfter,
  children,
  className,
}: ParameterListProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const childArray = React.Children.toArray(children);

  const shouldCollapse = collapseAfter !== undefined && childArray.length > collapseAfter;
  const visibleChildren = shouldCollapse && !expanded ? childArray.slice(0, collapseAfter) : childArray;
  const hiddenCount = shouldCollapse ? childArray.length - collapseAfter : 0;

  return (
    <div className={cn('', className)}>
      {title && (
        <h3 className="text-sm font-medium text-foreground mb-3 uppercase tracking-wide">{title}</h3>
      )}
      <div className="divide-y divide-border border-t border-b border-border">
        {visibleChildren}
      </div>
      {shouldCollapse && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 mt-3 text-sm text-primary hover:underline cursor-pointer"
        >
          <ChevronDown size={14} />
          Show {hiddenCount} more {hiddenCount === 1 ? 'parameter' : 'parameters'}
        </button>
      )}
    </div>
  );
}
