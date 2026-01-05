'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

export interface ImportSectionProps {
  /** Import statement text */
  importStatement: string;
  /** Custom className */
  className?: string;
}

/**
 * Displays a copyable import statement with one-click copy.
 * Monospace styling with copy button.
 */
export function ImportSection({ importStatement, className }: ImportSectionProps): React.ReactNode {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(importStatement);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className={cn(
        'group flex items-center justify-between gap-3',
        'rounded-lg border border-border bg-muted/30 px-4 py-3',
        className,
      )}
    >
      <code className="font-mono text-sm text-foreground overflow-x-auto">{importStatement}</code>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'shrink-0 p-1.5 rounded',
          'text-muted-foreground hover:text-foreground',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
          'cursor-pointer',
        )}
        aria-label="Copy import statement"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
}
