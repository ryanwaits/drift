import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';

// Button variant types
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'nav' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'nav';

function ArrowIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6.5 12L17 12M13 16.5L17.5 12L13 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

const buttonVariants: (props?: {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  className?: string;
}) => string = cva(
  // Base styles: monospace font, flex layout, transitions
  'inline-flex items-center justify-center whitespace-nowrap font-mono font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border-none rounded hover:opacity-90 active:opacity-80 active:scale-[0.98]',
        secondary:
          'bg-transparent text-[var(--btn-secondary-text)] border border-[var(--btn-secondary-border)] rounded hover:bg-[var(--btn-secondary-hover)] active:scale-[0.98]',
        ghost:
          'bg-transparent text-[var(--btn-ghost-text)] border-none rounded hover:opacity-70 active:opacity-60 active:scale-[0.98]',
        nav: 'bg-transparent text-[var(--btn-nav-text)] border-none font-normal hover:underline underline-offset-4',
        danger:
          'bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-600 hover:text-white hover:border-red-600 active:bg-red-700 active:scale-[0.98] dark:bg-red-950 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-600 dark:hover:text-white',
      },
      size: {
        sm: 'h-8 px-3 py-1 text-sm gap-2 [&_svg]:size-4',
        md: 'h-10 px-5 py-1 text-base gap-3 [&_svg]:size-5',
        lg: 'h-12 px-6 py-2 text-base gap-3 [&_svg]:size-6',
        nav: 'h-auto p-0 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Show the trailing arrow */
  withArrow?: boolean;
  /** For nav links with muted count like "GitHub [34K]" */
  count?: string;
}

const Button: React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLButtonElement>
> = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading,
      leftIcon,
      rightIcon,
      withArrow,
      count,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const _Comp = asChild ? Slot : 'button';
    const effectiveSize = variant === 'nav' ? 'nav' : size;

    const arrowPaddingClass =
      withArrow && effectiveSize !== 'nav'
        ? effectiveSize === 'sm'
          ? 'pl-3 pr-2'
          : effectiveSize === 'lg'
            ? 'pl-6 pr-4'
            : 'pl-5 pr-3'
        : '';

    if (asChild) {
      return (
        <Slot
          className={cn(
            buttonVariants({ variant, size: effectiveSize, className }),
            arrowPaddingClass,
          )}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(
          buttonVariants({ variant, size: effectiveSize, className }),
          arrowPaddingClass,
        )}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <Loader2 className="animate-spin" /> : leftIcon ? leftIcon : null}
        <span>
          {children}
          {count && <span className="text-[var(--btn-count-text)]"> [{count}]</span>}
        </span>
        {!isLoading && (withArrow ? <ArrowIcon /> : rightIcon)}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants, ArrowIcon };
