'use client';

import { cn } from '../../lib/utils';
import type { TimeRange } from './types';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
}

const ranges: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
  { value: 'versions', label: 'Versions' },
];

export function TimeRangeSelector({ value, onChange, className }: TimeRangeSelectorProps): React.ReactNode {
  return (
    <div
      className={cn(
        'inline-flex items-stretch border border-border rounded bg-background',
        className,
      )}
    >
      {ranges.map((range, index) => {
        const isActive = range.value === value;
        const isLast = index === ranges.length - 1;

        return (
          <button
            key={range.value}
            type="button"
            onClick={() => onChange(range.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-mono transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              !isLast && 'border-r border-border',
              isActive
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
