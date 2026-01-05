'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { RegressionInfo } from './types';

interface RegressionAlertProps {
  regression: RegressionInfo;
  className?: string;
}

export function RegressionAlert({ regression, className }: RegressionAlertProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg',
        'bg-warning-light border border-warning/20',
        className,
      )}
    >
      <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Coverage dropped {regression.coverageDrop}%
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {regression.exportsLost} exports lost documentation between{' '}
          <span className="font-mono">{regression.fromVersion}</span> and{' '}
          <span className="font-mono">{regression.toVersion}</span>
        </p>
      </div>
    </div>
  );
}
