import * as React from 'react';
import { cn } from '../../lib/utils';

interface FileChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  filename: string;
  clickable?: boolean;
}

const FileChip: React.ForwardRefExoticComponent<
  FileChipProps & React.RefAttributes<HTMLSpanElement>
> = React.forwardRef<HTMLSpanElement, FileChipProps>(
  ({ filename, clickable = true, className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-sm',
          'bg-secondary text-secondary-foreground',
          clickable && 'cursor-pointer hover:bg-accent transition-colors',
          className,
        )}
        {...props}
      >
        <span className="text-muted-foreground">@</span>
        {filename}
      </span>
    );
  },
);
FileChip.displayName = 'FileChip';

export { FileChip, type FileChipProps };
