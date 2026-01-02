'use client';

import { Check, Copy } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '../../lib/utils';

export interface CodeTab {
  /** Tab label */
  label: string;
  /** Tab content (code block) */
  content: ReactNode;
  /** Raw code for copy button */
  code: string;
}

export interface CodeTabsProps {
  /** Array of tabs */
  tabs: CodeTab[];
  /** Default selected tab index */
  defaultIndex?: number;
  /** Enable sticky positioning for the header */
  sticky?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Tabbed code block wrapper with copy button per tab.
 * Uses docskit --dk-* CSS variables for consistent theming.
 */
export function CodeTabs({
  tabs,
  defaultIndex = 0,
  sticky = false,
  className,
}: CodeTabsProps): React.ReactNode {
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const [copied, setCopied] = useState(false);

  const activeTab = tabs[activeIndex];

  const handleCopy = () => {
    if (!activeTab) return;
    navigator.clipboard.writeText(activeTab.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (!tabs.length) return null;

  return (
    <div
      className={cn(
        'group rounded-lg border border-dk-border bg-dk-background overflow-hidden',
        'selection:bg-dk-selection selection:text-current',
        className,
      )}
    >
      {/* Tab list - uses docskit styling */}
      <div
        className={cn(
          'flex items-center border-b border-dk-border bg-dk-tabs-background',
          sticky && 'sticky top-0 z-10',
        )}
      >
        <div className="flex-1 flex items-stretch">
          {tabs.map((tab, index) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                'px-4 py-2 text-sm font-mono transition-colors duration-200',
                'border-r border-dk-border last:border-r-0',
                index === activeIndex
                  ? 'text-dk-tab-active-foreground bg-dk-background/50'
                  : 'text-dk-tab-inactive-foreground hover:text-dk-tab-active-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'p-2 mx-2',
            'text-dk-tab-inactive-foreground hover:text-dk-tab-active-foreground',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'cursor-pointer',
          )}
          aria-label="Copy code"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      {/* Tab content */}
      <div className="bg-dk-background">{activeTab?.content}</div>
    </div>
  );
}
