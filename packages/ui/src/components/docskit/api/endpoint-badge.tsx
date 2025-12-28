import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../../../lib/utils';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

const endpointBadgeVariants = cva(
  'inline-flex items-center justify-center font-mono font-bold uppercase tracking-wide rounded shrink-0',
  {
    variants: {
      method: {
        GET: 'bg-emerald-500/15 text-emerald-500',
        POST: 'bg-blue-500/15 text-blue-500',
        PUT: 'bg-amber-500/15 text-amber-500',
        DELETE: 'bg-rose-500/15 text-rose-500',
        PATCH: 'bg-violet-500/15 text-violet-500',
      },
      size: {
        sm: 'h-5 px-1.5 text-[10px]',
        md: 'h-6 px-2 text-xs',
      },
    },
    defaultVariants: {
      method: 'GET',
      size: 'md',
    },
  },
);

export interface EndpointBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof endpointBadgeVariants> {
  method: HttpMethod;
}

const EndpointBadge = React.forwardRef<HTMLSpanElement, EndpointBadgeProps>(
  ({ className, method, size, ...props }, ref) => {
    return (
      <span ref={ref} className={cn(endpointBadgeVariants({ method, size, className }))} {...props}>
        {method}
      </span>
    );
  },
);
EndpointBadge.displayName = 'EndpointBadge';

export { EndpointBadge, endpointBadgeVariants };
