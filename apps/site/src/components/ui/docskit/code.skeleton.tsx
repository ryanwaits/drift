'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

interface SkeletonLineProps {
  width?: string;
}

function SkeletonLine({ width = '75%' }: SkeletonLineProps) {
  return <div className="h-4 bg-openpkg-code-border/20 rounded animate-pulse" style={{ width }} />;
}

export function CodeBlockSkeleton({
  hasTitle = true,
  lines = 6,
}: {
  hasTitle?: boolean;
  lines?: number;
}): React.ReactNode {
  const id = useId();
  const lineWidths = Array.from({ length: lines }, (_, i) => {
    const widths = ['40%', '65%', '55%', '80%', '45%', '70%', '60%', '50%'];
    return widths[i % widths.length];
  });

  return (
    <div className="rounded overflow-hidden border border-openpkg-code-border my-4 not-prose">
      {hasTitle && (
        <div
          className={cn(
            'border-b border-openpkg-code-border bg-openpkg-code-header px-3 py-0',
            'w-full h-9 flex items-center shrink-0',
          )}
        >
          <div className="flex items-center h-5 gap-2">
            <div className="size-4 bg-openpkg-code-border/30 rounded animate-pulse" />
            <div className="h-4 w-20 bg-openpkg-code-border/30 rounded animate-pulse" />
          </div>
        </div>
      )}
      <div className="bg-openpkg-code-bg px-4 py-3 space-y-2">
        {lineWidths.map((width, i) => (
          <SkeletonLine key={`${id}-line-${i}`} width={width} />
        ))}
      </div>
    </div>
  );
}

export function TerminalSkeleton({ lines = 3 }: { lines?: number }): React.ReactNode {
  const id = useId();
  const lineWidths = Array.from({ length: lines }, (_, i) => {
    const widths = ['60%', '45%', '70%', '55%'];
    return widths[i % widths.length];
  });

  return (
    <div className="rounded overflow-hidden border border-openpkg-code-border my-4 not-prose">
      <div
        className={cn(
          'border-b border-openpkg-code-border bg-openpkg-code-header',
          'w-full h-9 flex items-center justify-center shrink-0',
          'relative',
        )}
      >
        <div className="absolute left-3 flex items-center gap-2">
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
        </div>
      </div>
      <div className="bg-openpkg-code-bg px-4 py-3 space-y-2">
        {lineWidths.map((width, i) => (
          <SkeletonLine key={`${id}-line-${i}`} width={width} />
        ))}
      </div>
    </div>
  );
}

export function InlineCodeSkeleton(): React.ReactNode {
  return (
    <span className="inline-block h-5 w-16 bg-openpkg-code-border/20 rounded border border-openpkg-code-border animate-pulse align-middle" />
  );
}

export function CodeTabsSkeleton({
  tabs = 2,
  lines = 6,
}: {
  tabs?: number;
  lines?: number;
}): React.ReactNode {
  const id = useId();
  const lineWidths = Array.from({ length: lines }, (_, i) => {
    const widths = ['40%', '65%', '55%', '80%', '45%', '70%'];
    return widths[i % widths.length];
  });

  return (
    <div className="rounded overflow-hidden border border-openpkg-code-border my-4 not-prose">
      <div
        className={cn(
          'border-b border-openpkg-code-border bg-openpkg-code-header px-2 py-0',
          'w-full h-9 flex items-center shrink-0 gap-1',
        )}
      >
        {Array.from({ length: tabs }).map((_, i) => (
          <div key={`${id}-tab-${i}`} className="flex items-center gap-1.5 px-3 h-full">
            <div className="size-4 bg-openpkg-code-border/30 rounded animate-pulse" />
            <div className="h-4 w-16 bg-openpkg-code-border/30 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="bg-openpkg-code-bg px-4 py-3 space-y-2">
        {lineWidths.map((width, i) => (
          <SkeletonLine key={`${id}-line-${i}`} width={width} />
        ))}
      </div>
    </div>
  );
}
