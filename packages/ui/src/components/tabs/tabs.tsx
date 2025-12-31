'use client';

import { Plus, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';

interface TabCellBase {
  id: string;
  label: string;
  isActive?: boolean;
}

interface TextTab extends TabCellBase {
  type: 'text';
}

interface CountTab extends TabCellBase {
  type: 'count';
  count: number;
}

interface FileTab extends TabCellBase {
  type: 'file';
  fileType?: 'ts' | 'tsx' | 'js' | 'jsx' | 'html' | 'css' | 'json' | 'md';
  closeable?: boolean;
}

interface ProgressTab extends TabCellBase {
  type: 'progress';
  percent: number;
}

interface ActionTab {
  id: string;
  type: 'action';
  icon: React.ReactNode;
  label?: string;
}

type TabCell = TextTab | CountTab | FileTab | ProgressTab | ActionTab;

interface SegmentedTabsProps {
  tabs: TabCell[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onAction?: (id: string) => void;
  className?: string;
}

// File type icon colors
const fileTypeColors: Record<string, string> = {
  ts: 'bg-blue-500',
  tsx: 'bg-blue-500',
  js: 'bg-yellow-500',
  jsx: 'bg-yellow-500',
  html: 'bg-orange-500',
  css: 'bg-purple-500',
  json: 'bg-green-600',
  md: 'bg-stone-500',
};

const fileTypeLabels: Record<string, string> = {
  ts: 'TS',
  tsx: 'TS',
  js: 'JS',
  jsx: 'JS',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  md: 'MD',
};

// Small circle progress indicator
function MiniProgress({ percent, className }: { percent: number; className?: string }) {
  const radius = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <svg className={cn('size-4', className)} viewBox="0 0 14 14" aria-hidden="true">
      <circle
        cx="7"
        cy="7"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="opacity-20"
      />
      <circle
        cx="7"
        cy="7"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
}

const SegmentedTabs: React.ForwardRefExoticComponent<
  SegmentedTabsProps & React.RefAttributes<HTMLDivElement>
> = React.forwardRef<HTMLDivElement, SegmentedTabsProps>(
  ({ tabs, activeTab, onTabChange, onTabClose, onAction, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-stretch',
          'border border-border rounded-md',
          'bg-background shadow-sm',
          className,
        )}
      >
        {tabs.map((tab, index) => {
          const isLast = index === tabs.length - 1;
          const isActive = 'isActive' in tab ? tab.isActive : tab.id === activeTab;
          const isAction = tab.type === 'action';
          const isFileWithClose = tab.type === 'file' && tab.closeable && onTabClose;

          // File tabs with close button need special handling to avoid nested buttons
          if (isFileWithClose && tab.type === 'file') {
            return (
              <div
                key={tab.id}
                className={cn('relative flex items-center', !isLast && 'border-r border-border')}
              >
                <button
                  type="button"
                  onClick={() => onTabChange?.(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 pl-3 pr-1 py-2 text-[13px] transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    isActive
                      ? 'bg-accent text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center justify-center size-4 rounded-[3px] text-[8px] font-bold text-white',
                      fileTypeColors[tab.fileType || 'ts'] || 'bg-stone-500',
                    )}
                  >
                    {fileTypeLabels[tab.fileType || 'ts']}
                  </span>
                  <span className="font-mono text-[13px]">{tab.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTabClose(tab.id)}
                  className={cn(
                    'p-0.5 mr-2 rounded-sm transition-colors',
                    'text-muted-foreground/50 hover:text-foreground hover:bg-accent',
                    isActive ? 'bg-accent' : '',
                  )}
                  aria-label={`Close ${tab.label}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (isAction) {
                  onAction?.(tab.id);
                } else {
                  onTabChange?.(tab.id);
                }
              }}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-2 text-[13px] transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                // Vertical divider (border-right) except for last item
                !isLast && 'border-r border-border',
                // States
                isActive
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                // Action tabs are more compact
                isAction && 'px-2.5',
              )}
            >
              {/* Render based on tab type */}
              {tab.type === 'text' && <span>{tab.label}</span>}

              {tab.type === 'count' && (
                <>
                  <span>{tab.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">({tab.count})</span>
                </>
              )}

              {tab.type === 'file' && (
                <>
                  {/* File type icon */}
                  <span
                    className={cn(
                      'flex items-center justify-center size-4 rounded-[3px] text-[8px] font-bold text-white',
                      fileTypeColors[tab.fileType || 'ts'] || 'bg-stone-500',
                    )}
                  >
                    {fileTypeLabels[tab.fileType || 'ts']}
                  </span>
                  <span className="font-mono text-[13px]">{tab.label}</span>
                </>
              )}

              {tab.type === 'progress' && (
                <>
                  <MiniProgress percent={tab.percent} />
                  <span className="tabular-nums">{tab.percent}%</span>
                </>
              )}

              {tab.type === 'action' && <>{tab.icon}</>}
            </button>
          );
        })}
      </div>
    );
  },
);
SegmentedTabs.displayName = 'SegmentedTabs';

// Also export Tabs for backwards compatibility during migration
interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  closeable?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onTabClose?: (id: string) => void;
  onAddTab?: () => void;
  className?: string;
  size?: 'default' | 'lg';
}

const Tabs: React.ForwardRefExoticComponent<
  TabsProps & React.RefAttributes<HTMLDivElement>
> = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ tabs, activeTab, onTabChange, onTabClose, onAddTab, className, size = 'default' }, ref) => {
    // Convert old format to new format
    const convertedTabs: TabCell[] = tabs.map((tab) => {
      if (tab.count !== undefined) {
        return {
          id: tab.id,
          type: 'count' as const,
          label: tab.label,
          count: tab.count,
        };
      }
      if (tab.closeable) {
        return {
          id: tab.id,
          type: 'file' as const,
          label: tab.label,
          closeable: true,
        };
      }
      return {
        id: tab.id,
        type: 'text' as const,
        label: tab.label,
      };
    });

    if (onAddTab) {
      convertedTabs.push({
        id: '__add__',
        type: 'action',
        icon: <Plus className="size-4" />,
      });
    }

    return (
      <SegmentedTabs
        ref={ref}
        tabs={convertedTabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        onTabClose={onTabClose}
        onAction={(id) => {
          if (id === '__add__' && onAddTab) {
            onAddTab();
          }
        }}
        className={cn(size === 'lg' && '[&_button]:px-4 [&_button]:py-3', className)}
      />
    );
  },
);
Tabs.displayName = 'Tabs';

export { SegmentedTabs, Tabs, type TabCell, type TabItem, type SegmentedTabsProps, type TabsProps };
