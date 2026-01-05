'use client';

import {
  type AnnotationHandler,
  type HighlightedCode,
  highlight,
  Pre,
  type RawCode,
} from 'codehike/code';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible';
import { flagsToOptions, theme } from '../docskit/code.config';
import { CopyButton } from '../docskit/code.copy';
import { getHandlers } from '../docskit/code.handlers';
import { CodeIcon } from '../docskit/code.icon';

function StackedChevrons({ isOpen, className }: { isOpen?: boolean; className?: string }): React.ReactNode {
  return (
    <div className={cn('flex flex-col items-center -space-y-1 transition-opacity', className)}>
      <ChevronUp
        className={cn(
          'size-3 transition-colors',
          isOpen ? 'text-dk-tab-active-foreground' : 'text-dk-tab-inactive-foreground',
        )}
      />
      <ChevronDown
        className={cn(
          'size-3 transition-colors',
          isOpen ? 'text-dk-tab-active-foreground' : 'text-dk-tab-inactive-foreground',
        )}
      />
    </div>
  );
}

/** Get language from filename extension */
function getLangFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const extMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
    py: 'python',
    rs: 'rust',
    go: 'go',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return extMap[ext] || ext;
}

interface FileChangeRowProps {
  path: string;
  filename: string;
  additions?: number;
  deletions?: number;
  /** Code block to highlight and render */
  codeblock?: RawCode;
  /** Extra annotation handlers for code */
  handlers?: AnnotationHandler[];
  /** Show copy button */
  showCopy?: boolean;
  /** Fallback children if no codeblock provided */
  children?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

function FileChangeRow({
  path,
  filename,
  additions,
  deletions,
  codeblock,
  handlers: extraHandlers,
  showCopy = true,
  children,
  defaultOpen = false,
  className,
}: FileChangeRowProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

  const lang = getLangFromFilename(filename);
  const hasAdditions = additions !== undefined && additions > 0;
  const hasDeletions = deletions !== undefined && deletions > 0;

  // Highlight code if codeblock provided
  useEffect(() => {
    if (!codeblock) return;

    let cancelled = false;
    const codeWithLang = { ...codeblock, lang: codeblock.lang || lang || 'txt' };

    highlight(codeWithLang, theme).then((result) => {
      if (!cancelled) setHighlighted(result);
    });

    return () => {
      cancelled = true;
    };
  }, [codeblock?.value, codeblock?.lang, codeblock?.meta, lang, codeblock]);

  const options = flagsToOptions('');
  const handlers = getHandlers(options);
  if (extraHandlers) {
    handlers.push(...extraHandlers);
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="group rounded overflow-hidden border border-dk-border">
        {/* Header */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 px-3 py-0 cursor-pointer w-full text-left',
              'h-9 shrink-0 font-mono text-sm',
              'bg-dk-tabs-background',
              isOpen && 'border-b border-dk-border',
              'text-dk-tab-inactive-foreground',
              'hover:bg-dk-background/50 transition-colors',
            )}
          >
            <div className="size-4 shrink-0 opacity-60">
              <CodeIcon title={filename} lang={lang} />
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-1">
              {path && <span className="text-dk-tab-inactive-foreground truncate">{path}</span>}
              <span className="text-dk-tab-active-foreground font-medium truncate">{filename}</span>
            </div>

            <div className="flex items-center gap-2 text-sm shrink-0">
              {hasAdditions && <span className="text-green-500 font-medium">+{additions}</span>}
              {hasDeletions && <span className="text-red-500 font-medium">-{deletions}</span>}
            </div>

            <StackedChevrons isOpen={isOpen} className="ml-1" />
          </button>
        </CollapsibleTrigger>

        {/* Content */}
        <CollapsibleContent className="relative">
          {codeblock && highlighted ? (
            <>
              <Pre
                code={highlighted}
                className="overflow-auto px-0 py-3 m-0 rounded-none !bg-dk-background selection:bg-dk-selection selection:text-current max-h-full"
                style={highlighted.style}
                handlers={handlers}
              />
              {showCopy && (
                <CopyButton
                  text={highlighted.code}
                  variant="floating"
                  className="absolute right-3 top-3 z-10 text-dk-tab-inactive-foreground"
                />
              )}
            </>
          ) : (
            children
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface FileChangeListProps {
  title?: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

function FileChangeList({
  title = 'Changed files',
  count,
  children,
  defaultOpen = true,
  className,
}: FileChangeListProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors py-2"
        >
          <StackedChevrons isOpen={isOpen} />
          <span>{count !== undefined ? `${count} ${title}` : title}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 mt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export {
  FileChangeRow,
  FileChangeList,
  StackedChevrons,
  getLangFromFilename,
  type FileChangeRowProps,
  type FileChangeListProps,
};
