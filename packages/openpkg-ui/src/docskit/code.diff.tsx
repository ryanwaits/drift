'use client';

import {
  type AnnotationHandler,
  type HighlightedCode,
  highlight,
  Pre,
  type RawCode,
} from 'codehike/code';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/collapsible';
import { cn } from '@/lib/utils';
import { flagsToOptions, theme } from './code.config';
import { CopyButton } from './code.copy';
import { getHandlers } from './code.handlers';
import { CodeIcon } from './code.icon';
import { CodeBlockSkeleton } from './code.skeleton';

function StackedChevrons({ isOpen, className }: { isOpen?: boolean; className?: string }) {
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

interface DiffStats {
  additions?: number;
  deletions?: number;
}

interface ClientDiffCodeProps {
  codeblock: RawCode;
  /** Full file path (e.g., "src/components/") */
  path?: string;
  /** Filename (e.g., "index.ts") - if not provided, extracted from codeblock meta */
  filename?: string;
  /** Diff statistics */
  diff?: DiffStats;
  /** Extra annotation handlers */
  handlers?: AnnotationHandler[];
  /** Wrapper className */
  className?: string;
  /** Start collapsed */
  defaultOpen?: boolean;
}

/**
 * DocKit code block variant with file change row header.
 * Displays path/filename with diff stats, collapsible with syntax-highlighted code.
 */
export function ClientDiffCode(props: ClientDiffCodeProps) {
  const {
    codeblock,
    path = '',
    filename: filenameProp,
    diff,
    handlers: extraHandlers,
    className: wrapperClassName,
    defaultOpen = true,
  } = props;

  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { title, flags } = extractFlags(codeblock);
  const options = flagsToOptions(flags);

  // Use provided filename, or extract from meta title
  const filename = filenameProp || title || 'file';

  useEffect(() => {
    let cancelled = false;

    highlight({ ...codeblock, lang: codeblock.lang || 'txt' }, theme).then((result) => {
      if (!cancelled) setHighlighted(result);
    });

    return () => {
      cancelled = true;
    };
  }, [codeblock.value, codeblock.lang, codeblock.meta, codeblock]);

  if (!highlighted) {
    return <CodeBlockSkeleton hasTitle />;
  }

  const handlers = getHandlers(options);
  if (extraHandlers) {
    handlers.push(...extraHandlers);
  }

  const { background: _background, ...highlightedStyle } = highlighted.style;
  const showCopy = options?.copyButton;
  const icon = <CodeIcon title={filename} lang={codeblock.lang} className="opacity-60" />;

  const hasAdditions = diff?.additions !== undefined && diff.additions > 0;
  const hasDeletions = diff?.deletions !== undefined && diff.deletions > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'group rounded overflow-hidden relative border-dk-border flex flex-col border my-4 not-prose',
          wrapperClassName,
        )}
      >
        {/* Header - always visible */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'border-b border-dk-border bg-dk-tabs-background px-3 py-0',
              'w-full h-9 flex items-center shrink-0 cursor-pointer',
              'text-dk-tab-inactive-foreground text-sm font-mono',
              'hover:bg-dk-background/50 transition-colors',
            )}
          >
            <div className="flex items-center h-5 gap-2 flex-1 min-w-0">
              <div className="size-4 shrink-0">{icon}</div>
              {path && <span className="text-dk-tab-inactive-foreground truncate">{path}</span>}
              <span className="text-dk-tab-active-foreground font-medium truncate">{filename}</span>
            </div>

            {/* Diff stats */}
            <div className="flex items-center gap-2 text-sm shrink-0 ml-2">
              {hasAdditions && (
                <span className="text-green-500 font-medium">+{diff.additions}</span>
              )}
              {hasDeletions && <span className="text-red-500 font-medium">-{diff.deletions}</span>}
            </div>

            <StackedChevrons isOpen={isOpen} className="ml-2" />
          </button>
        </CollapsibleTrigger>

        {/* Collapsible code content */}
        <CollapsibleContent>
          <div className="relative flex items-start">
            <Pre
              code={highlighted}
              className="overflow-auto px-0 py-3 m-0 rounded-none !bg-dk-background selection:bg-dk-selection selection:text-current max-h-full flex-1"
              style={highlightedStyle}
              handlers={handlers}
            />
            {showCopy && (
              <CopyButton
                text={highlighted.code}
                variant="floating"
                className="absolute right-3 top-3 z-10 text-dk-tab-inactive-foreground"
              />
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Extracts flags and title from the metadata of a code block.
 */
function extractFlags(codeblock: RawCode) {
  const meta = codeblock.meta || '';
  const flags = meta.split(' ').filter((flag) => flag.startsWith('-'))[0] ?? '';
  const metaWithoutFlags = !flags
    ? meta
    : meta === flags
      ? ''
      : meta.replace(` ${flags}`, '').trim();
  const title = metaWithoutFlags.trim();
  return { title, flags: flags.slice(1) };
}

export type { ClientDiffCodeProps, DiffStats };
