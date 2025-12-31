'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../../lib/utils';

// Input variant types
export type InputSize = 'sm' | 'md' | 'lg';
export type InputVariant = 'default' | 'error';

const inputVariants: (props?: {
  inputSize?: InputSize | null;
  variant?: InputVariant | null;
  className?: string;
}) => string = cva(
  // Base styles - monospace font, warm grays, smooth transition
  [
    'w-full font-mono text-[var(--input-text)]',
    'placeholder:text-[var(--input-placeholder)]',
    'border border-[var(--input-border)]',
    'bg-[var(--input-bg)]',
    'rounded-md outline-none transition-all duration-150',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      inputSize: {
        sm: 'h-10 px-3 text-sm',
        md: 'h-12 px-4 text-base',
        lg: 'h-[66px] px-5 text-base', // OpenCode signature tall height
      },
      variant: {
        default: [
          'hover:border-[var(--input-border-hover)]',
          // Yellow focus ring - signature OpenCode style
          'focus:border-[var(--input-border-focus)]',
          'focus:bg-[var(--input-bg-focus)]',
          'focus:shadow-[var(--input-focus-shadow)]',
        ],
        error: [
          'border-destructive/60',
          'focus:border-destructive',
          'focus:shadow-[0_0_0_3px_rgb(254,202,202)]',
        ],
      },
    },
    defaultVariants: {
      inputSize: 'lg',
      variant: 'default',
    },
  },
);

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: InputSize | null;
  variant?: InputVariant | null;
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

const Input: React.ForwardRefExoticComponent<
  InputProps & React.RefAttributes<HTMLInputElement>
> = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize, variant, label, helperText, error, leftIcon, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || `input-${generatedId}`;
    const hasError = !!error;

    return (
      <div className="w-full space-y-2">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--input-text)]">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--input-placeholder)] [&_svg]:size-5">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              inputVariants({ inputSize, variant: hasError ? 'error' : variant }),
              leftIcon && 'pl-12',
              className,
            )}
            {...props}
          />
        </div>
        {(helperText || error) && (
          <p
            className={cn(
              'text-sm font-mono',
              hasError ? 'text-destructive' : 'text-[var(--input-placeholder)]',
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export interface InputWithButtonProps extends Omit<InputProps, 'rightIcon' | 'onSubmit'> {
  buttonText?: string;
  buttonLoading?: boolean;
  onButtonClick?: () => void;
  onSubmit?: (value: string) => void;
}

const InputWithButton: React.ForwardRefExoticComponent<
  InputWithButtonProps & React.RefAttributes<HTMLInputElement>
> = React.forwardRef<HTMLInputElement, InputWithButtonProps>(
  (
    {
      className,
      inputSize = 'lg',
      buttonText = 'Subscribe',
      buttonLoading,
      onButtonClick,
      onSubmit,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = props.id || `input-${generatedId}`;
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleClick = () => {
      if (onSubmit && inputRef.current) {
        onSubmit(inputRef.current.value);
      }
      onButtonClick?.();
    };

    return (
      <div className="w-full space-y-2">
        {props.label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--input-text)]">
            {props.label}
          </label>
        )}
        <div className="relative">
          {props.leftIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--input-placeholder)] [&_svg]:size-5">
              {props.leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={(node) => {
              (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            className={cn(
              inputVariants({ inputSize, variant: props.error ? 'error' : 'default' }),
              props.leftIcon && 'pl-12',
              'pr-36', // Make room for button
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={handleClick}
            disabled={props.disabled || buttonLoading}
            className={cn(
              'absolute top-1/2 right-3 -translate-y-1/2',
              'h-10 px-5 rounded',
              'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]',
              'font-mono text-base font-medium',
              'hover:opacity-90',
              'transition-colors duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {buttonLoading ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  className="animate-spin size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-25"
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    className="opacity-75"
                  />
                </svg>
                ...
              </span>
            ) : (
              buttonText
            )}
          </button>
        </div>
        {(props.helperText || props.error) && (
          <p
            className={cn(
              'text-sm font-mono',
              props.error ? 'text-destructive' : 'text-[var(--input-placeholder)]',
            )}
          >
            {props.error || props.helperText}
          </p>
        )}
      </div>
    );
  },
);
InputWithButton.displayName = 'InputWithButton';

export interface SearchInputProps extends Omit<InputProps, 'leftIcon'> {
  onClear?: () => void;
  showClear?: boolean;
}

const SearchInput: React.ForwardRefExoticComponent<
  SearchInputProps & React.RefAttributes<HTMLInputElement>
> = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, inputSize = 'md', showClear, onClear, ...props }, ref) => {
    const inputId = React.useId();
    return (
      <div className="w-full space-y-2">
        {props.label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--input-text)]">
            {props.label}
          </label>
        )}
        <div className="relative">
          {/* Search icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--input-placeholder)]">
            <svg
              className="size-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            id={inputId}
            ref={ref}
            className={cn(
              inputVariants({ inputSize, variant: props.error ? 'error' : 'default' }),
              'pl-12',
              showClear && 'pr-10',
              className,
            )}
            {...props}
          />
          {/* Clear button */}
          {showClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--input-placeholder)] hover:text-[var(--input-text)] transition-colors"
            >
              <svg
                className="size-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        {(props.helperText || props.error) && (
          <p
            className={cn(
              'text-sm font-mono',
              props.error ? 'text-destructive' : 'text-[var(--input-placeholder)]',
            )}
          >
            {props.error || props.helperText}
          </p>
        )}
      </div>
    );
  },
);
SearchInput.displayName = 'SearchInput';

export { Input, InputWithButton, SearchInput, inputVariants };
