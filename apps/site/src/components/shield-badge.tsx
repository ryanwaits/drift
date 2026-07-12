export function ShieldBadge({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string;
  variant?: 'default' | 'green';
}) {
  return (
    <span className="inline-flex items-center overflow-hidden rounded-md border border-border text-xs font-medium">
      <span
        className={
          variant === 'green'
            ? 'bg-[#2d3a2e] px-2.5 py-1 text-green-200'
            : 'bg-card-bg px-2.5 py-1 text-text-muted'
        }
      >
        {label}
      </span>
      <span
        className={
          variant === 'green' ? 'bg-green-100 px-2.5 py-1 text-green-700' : 'px-2.5 py-1 text-text'
        }
      >
        {value}
      </span>
    </span>
  );
}
