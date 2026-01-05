'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TrendDirection } from './types';

interface TrendIndicatorProps {
  value: number;
  direction: TrendDirection;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export function TrendIndicator({
  value,
  direction,
  size = 'md',
  showIcon = true,
  className,
}: TrendIndicatorProps): React.ReactNode {
  const isPositive = direction === 'up';
  const isNegative = direction === 'down';
  const isStable = direction === 'stable';

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-0.5',
    md: 'text-sm px-2 py-1 gap-1',
  };

  const iconSizes = {
    sm: 'size-3',
    md: 'size-3.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-mono font-medium rounded-full',
        sizeClasses[size],
        isPositive && 'bg-success-light text-success',
        isNegative && 'bg-destructive-light text-destructive',
        isStable && 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {showIcon && (
        <>
          {isPositive && <TrendingUp className={iconSizes[size]} />}
          {isNegative && <TrendingDown className={iconSizes[size]} />}
          {isStable && <Minus className={iconSizes[size]} />}
        </>
      )}
      <span className="tabular-nums">
        {isPositive ? '+' : isNegative ? '' : ''}
        {value}%
      </span>
    </span>
  );
}
