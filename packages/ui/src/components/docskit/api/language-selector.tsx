'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../../lib/utils';

export interface Language {
  /** Language identifier (e.g., "curl", "node", "python") */
  id: string;
  /** Display label (e.g., "cURL", "Node.js", "Python") */
  label: string;
}

export interface LanguageSelectorProps {
  /** Available languages */
  languages: Language[];
  /** Currently selected language id */
  value: string;
  /** Callback when language changes */
  onChange: (languageId: string) => void;
  /** Custom className */
  className?: string;
}

/**
 * Dropdown selector for choosing code example language.
 * Used in APICodePanel to switch between language examples.
 */
export function LanguageSelector({
  languages,
  value,
  onChange,
  className,
}: LanguageSelectorProps): React.ReactNode {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedLanguage = languages.find((l) => l.id === value);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium',
          'bg-muted/50 hover:bg-muted text-foreground transition-colors cursor-pointer',
        )}
      >
        {selectedLanguage?.label ?? value}
        <ChevronDown
          size={14}
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute top-full left-0 mt-1 z-50 min-w-[120px]',
            'bg-popover border border-border rounded-md shadow-lg overflow-hidden',
          )}
        >
          {languages.map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => {
                onChange(lang.id);
                setOpen(false);
              }}
              className={cn(
                'w-full px-3 py-2 text-sm text-left transition-colors cursor-pointer',
                lang.id === value
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
