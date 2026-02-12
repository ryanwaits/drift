import { cn } from '@/lib/utils';

export function CodeHeader({
  title,
  icon,
  className,
}: {
  title?: string;
  icon?: React.ReactNode;
  className?: string;
}): React.ReactNode {
  if (!title) return null;
  return (
    <div
      className={cn(
        'border-b-[1px] border-openpkg-code-border bg-openpkg-code-header px-3 py-0',
        'w-full h-9 flex items-center shrink-0',
        'text-openpkg-code-text-inactive text-sm font-mono',
        className,
      )}
    >
      <div className="flex items-center h-5 gap-2">
        {icon && <div className="size-4">{icon}</div>}
        <span className="leading-none">{title}</span>
      </div>
    </div>
  );
}
