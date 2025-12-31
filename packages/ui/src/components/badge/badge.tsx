import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../../lib/utils';

// Kind badge variant types
export type KindBadgeKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'namespace'
  | 'module'
  | 'reference'
  | 'external';

export type KindBadgeSize = 'sm' | 'md';

// Kind badges - for TypeScript syntax (fn, cls, type, etc.)
const kindBadgeVariants: (props?: {
  kind?: KindBadgeKind | null;
  size?: KindBadgeSize | null;
  className?: string;
}) => string = cva(
  'inline-flex items-center justify-center font-mono font-medium rounded shrink-0',
  {
    variants: {
      kind: {
        function: 'bg-kind-function/15 text-kind-function',
        class: 'bg-kind-class/15 text-kind-class',
        interface: 'bg-kind-interface/15 text-kind-interface',
        type: 'bg-kind-type/15 text-kind-type',
        enum: 'bg-kind-enum/15 text-kind-enum',
        variable: 'bg-kind-variable/15 text-kind-variable',
        namespace: 'bg-kind-namespace/15 text-kind-namespace',
        module: 'bg-kind-module/15 text-kind-module',
        reference: 'bg-kind-reference/15 text-kind-reference',
        external: 'bg-kind-external/15 text-kind-external',
      },
      size: {
        sm: 'h-4 px-1 text-[10px]',
        md: 'h-5 px-1.5 text-xs',
      },
    },
    defaultVariants: {
      kind: 'function',
      size: 'md',
    },
  },
);

export interface KindBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  kind?: KindBadgeKind | null;
  size?: KindBadgeSize | null;
  label?: string;
}

const KindBadge: React.ForwardRefExoticComponent<
  KindBadgeProps & React.RefAttributes<HTMLSpanElement>
> = React.forwardRef<HTMLSpanElement, KindBadgeProps>(
  ({ className, kind, size, label, ...props }, ref) => {
    const defaultLabels: Record<string, string> = {
      function: 'fn',
      class: 'cls',
      interface: 'int',
      type: 'type',
      enum: 'enum',
      variable: 'var',
      namespace: 'ns',
      module: 'mod',
      reference: 'ref',
      external: 'ext',
    };
    return (
      <span ref={ref} className={cn(kindBadgeVariants({ kind, size, className }))} {...props}>
        {label || defaultLabels[kind || 'function']}
      </span>
    );
  },
);
KindBadge.displayName = 'KindBadge';

// Status badge variant types
export type StatusBadgeStatus = 'success' | 'warning' | 'error' | 'neutral';
export type StatusBadgeSize = 'sm' | 'md';

// Status badges - for coverage/pass/fail states
const statusBadgeVariants: (props?: {
  status?: StatusBadgeStatus | null;
  size?: StatusBadgeSize | null;
  className?: string;
}) => string = cva(
  'inline-flex items-center justify-center gap-1 font-medium rounded-full',
  {
    variants: {
      status: {
        success: 'bg-success-light text-success',
        warning: 'bg-warning-light text-warning',
        error: 'bg-destructive-light text-destructive',
        neutral: 'bg-muted text-muted-foreground',
      },
      size: {
        sm: 'h-5 px-2 text-xs',
        md: 'h-6 px-2.5 text-sm',
      },
    },
    defaultVariants: {
      status: 'neutral',
      size: 'md',
    },
  },
);

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: StatusBadgeStatus | null;
  size?: StatusBadgeSize | null;
  label?: string;
  icon?: React.ReactNode;
}

const StatusBadge: React.ForwardRefExoticComponent<
  StatusBadgeProps & React.RefAttributes<HTMLSpanElement>
> = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, size, label, icon, children, ...props }, ref) => {
    return (
      <span ref={ref} className={cn(statusBadgeVariants({ status, size, className }))} {...props}>
        {icon}
        {label || children}
      </span>
    );
  },
);
StatusBadge.displayName = 'StatusBadge';

export {
  KindBadge,
  kindBadgeVariants,
  StatusBadge,
  statusBadgeVariants,
};
