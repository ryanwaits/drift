'use client';

import { Copy, Check } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';
import { cn } from '../../../lib/utils';
import { EndpointBadge, type HttpMethod } from './endpoint-badge';

export interface EndpointHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** HTTP method */
  method: HttpMethod;
  /** API path (e.g., "/v1/customers") */
  path: string;
  /** Show copy button on hover */
  copyable?: boolean;
}

const EndpointHeader = React.forwardRef<HTMLDivElement, EndpointHeaderProps>(
  ({ className, method, path, copyable = true, ...props }, ref) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
      navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    };

    return (
      <div
        ref={ref}
        className={cn(
          'group flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50 border border-border',
          className,
        )}
        {...props}
      >
        <EndpointBadge method={method} />
        <code className="font-mono text-sm text-foreground flex-1">{path}</code>
        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'p-1.5 rounded text-muted-foreground hover:text-foreground',
              'opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer',
            )}
            aria-label="Copy path"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>
    );
  },
);
EndpointHeader.displayName = 'EndpointHeader';

export { EndpointHeader };
