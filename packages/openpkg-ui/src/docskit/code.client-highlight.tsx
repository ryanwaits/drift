'use client';

import {
  type AnnotationHandler,
  type HighlightedCode,
  highlight,
  Inline,
  Pre,
  type RawCode,
} from 'codehike/code';
import { useEffect, useState } from 'react';
import { useStateOrLocalStorage } from '@/hooks/use-locale-storage';
import { cn } from '@/lib/utils';
import { type CodeOptions, flagsToOptions, theme } from './code.config';
import { CopyButton } from './code.copy';
import { getHandlers } from './code.handlers';
import { CodeIcon } from './code.icon';
import {
  CodeBlockSkeleton,
  CodeTabsSkeleton,
  InlineCodeSkeleton,
  TerminalSkeleton,
} from './code.skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

/**
 * Client-side code block with syntax highlighting.
 * Highlights code in useEffect to avoid SSR memory issues.
 */
export function ClientDocsKitCode(props: {
  codeblock: RawCode;
  handlers?: AnnotationHandler[];
  className?: string;
}) {
  const { codeblock, handlers: extraHandlers, className: wrapperClassName } = props;
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

  const { title, flags } = extractFlags(codeblock);
  const options = flagsToOptions(flags);

  useEffect(() => {
    let cancelled = false;

    highlight({ ...codeblock, lang: codeblock.lang || 'txt' }, theme).then((result) => {
      if (!cancelled) setHighlighted(result);
    });

    return () => {
      cancelled = true;
    };
    // Only depend on primitive values to avoid infinite re-renders
  }, [codeblock.value, codeblock.lang, codeblock.meta, codeblock]);

  if (!highlighted) {
    return <CodeBlockSkeleton hasTitle={!!title} />;
  }

  const handlers = getHandlers(options);
  if (extraHandlers) {
    handlers.push(...extraHandlers);
  }

  const { background: _background, ...highlightedStyle } = highlighted.style;
  const showCopy = options?.copyButton;
  const icon = <CodeIcon title={title} lang={codeblock.lang} className="opacity-60" />;

  return (
    <div
      className={cn(
        'group rounded overflow-hidden relative border-dk-border flex flex-col border my-4 not-prose',
        wrapperClassName,
      )}
    >
      {title ? (
        <div
          className={cn(
            'border-b-[1px] border-dk-border bg-dk-tabs-background px-3 py-0',
            'w-full h-9 flex items-center shrink-0',
            'text-dk-tab-inactive-foreground text-sm font-mono',
          )}
        >
          <div className="flex items-center h-5 gap-2">
            <div className="size-4">{icon}</div>
            <span className="leading-none">{title}</span>
          </div>
        </div>
      ) : null}
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
            className={cn(
              'absolute right-3 z-10 text-dk-tab-inactive-foreground',
              title ? 'top-3' : 'top-1/2 -translate-y-1/2',
            )}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Client-side terminal-style code block.
 */
export function ClientTerminal(props: { codeblock: RawCode; handlers?: AnnotationHandler[] }) {
  const { codeblock, handlers: extraHandlers } = props;
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

  const { flags } = extractFlagsSimple(codeblock);
  const options = flagsToOptions(flags);

  useEffect(() => {
    let cancelled = false;

    highlight({ ...codeblock, lang: codeblock.lang || 'bash' }, theme).then((result) => {
      if (!cancelled) setHighlighted(result);
    });

    return () => {
      cancelled = true;
    };
    // Only depend on primitive values to avoid infinite re-renders
  }, [codeblock.value, codeblock.lang, codeblock.meta, codeblock]);

  if (!highlighted) {
    return <TerminalSkeleton />;
  }

  const handlers = getHandlers(options);
  if (extraHandlers) {
    handlers.push(...extraHandlers);
  }

  const { background: _background, ...highlightedStyle } = highlighted.style;
  const showCopy = options?.copyButton;
  const isMultiLine = highlighted.code.includes('\n');

  return (
    <div className="group rounded overflow-hidden relative border-dk-border flex flex-col border my-4 not-prose">
      {/* Terminal header with macOS dots */}
      <div
        className={cn(
          'border-b border-dk-border bg-dk-tabs-background',
          'w-full h-9 flex items-center justify-center shrink-0',
          'relative',
        )}
      >
        {/* macOS window controls (3 dots) */}
        <div className="absolute left-3 flex items-center gap-2">
          <div className="size-3 rounded-full bg-dk-tab-inactive-foreground/30" />
          <div className="size-3 rounded-full bg-dk-tab-inactive-foreground/30" />
          <div className="size-3 rounded-full bg-dk-tab-inactive-foreground/30" />
        </div>
        <span className="sr-only">Terminal window</span>
      </div>

      {/* Code content */}
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
            className={cn(
              'absolute right-3 z-10 text-dk-tab-inactive-foreground',
              isMultiLine ? 'top-3' : 'top-1/2 -translate-y-1/2',
            )}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Client-side inline code with syntax highlighting.
 */
export function ClientInlineCode({ codeblock }: { codeblock: RawCode }) {
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

  useEffect(() => {
    let cancelled = false;

    highlight(codeblock, theme).then((result) => {
      if (!cancelled) setHighlighted(result);
    });

    return () => {
      cancelled = true;
    };
    // Only depend on primitive values to avoid infinite re-renders
  }, [codeblock.value, codeblock.lang, codeblock.meta, codeblock]);

  if (!highlighted) {
    return <InlineCodeSkeleton />;
  }

  return (
    <Inline
      code={highlighted}
      className="selection:bg-dk-selection selection:text-current rounded border border-dk-border px-1 py-0.5 whitespace-nowrap !bg-dk-background"
      style={highlighted.style}
    />
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

/**
 * Simple flag extraction (no title).
 */
function extractFlagsSimple(codeblock: RawCode) {
  const meta = codeblock.meta || '';
  const flagMatch = meta.split(' ').find((flag) => flag.startsWith('-'));
  const flags = flagMatch ? flagMatch.slice(1) : '';
  return { flags };
}

/**
 * Client-side code tabs with multiple files.
 */
export function ClientCode(props: { codeblocks: RawCode[]; flags?: string; storage?: string }) {
  const { codeblocks, flags: groupFlags, storage } = props;
  const [highlighted, setHighlighted] = useState<Map<
    number,
    {
      highlighted: HighlightedCode;
      title: string;
      options: CodeOptions;
      icon: React.ReactNode;
    }
  > | null>(null);

  const groupOptions = flagsToOptions(
    groupFlags?.startsWith('-') ? groupFlags.slice(1) : groupFlags,
  );

  // Create stable dependency key from codeblocks content
  const _codeBlocksKey = codeblocks.map((b) => `${b.value}|${b.lang}|${b.meta}`).join('::');

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      codeblocks.map(async (block, index) => {
        const { title, flags } = extractFlags(block);
        const tabOptions = flagsToOptions(flags);
        const options = { ...groupOptions, ...tabOptions };
        const result = await highlight({ ...block, lang: block.lang || 'txt' }, theme);
        return {
          index,
          highlighted: result,
          title,
          options,
          icon: <CodeIcon title={title} lang={block.lang} className="opacity-60" />,
        };
      }),
    ).then((results) => {
      if (!cancelled) {
        const map = new Map();
        results.forEach((r) => map.set(r.index, r));
        setHighlighted(map);
      }
    });

    return () => {
      cancelled = true;
    };
    // Only depend on primitive values to avoid infinite re-renders
    // biome-ignore lint/correctness/useExhaustiveDependencies: groupOptions is derived from groupFlags
  }, [codeblocks.map, groupOptions]);

  if (!highlighted) {
    return <CodeTabsSkeleton tabs={codeblocks.length} />;
  }

  // Single tab - render without tabs
  if (codeblocks.length === 1) {
    const tab = highlighted.get(0)!;
    const handlers = getHandlers(tab.options);
    const { background: _background, ...highlightedStyle } = tab.highlighted.style;

    return (
      <div className="group rounded overflow-hidden relative border-dk-border flex flex-col border my-4 not-prose">
        {tab.title ? (
          <div
            className={cn(
              'border-b-[1px] border-dk-border bg-dk-tabs-background px-3 py-0',
              'w-full h-9 flex items-center shrink-0',
              'text-dk-tab-inactive-foreground text-sm font-mono',
            )}
          >
            <div className="flex items-center h-5 gap-2">
              <div className="size-4">{tab.icon}</div>
              <span className="leading-none">{tab.title}</span>
            </div>
          </div>
        ) : null}
        <div className="relative flex items-start">
          <Pre
            code={tab.highlighted}
            className="overflow-auto px-0 py-3 m-0 rounded-none !bg-dk-background selection:bg-dk-selection selection:text-current max-h-full flex-1"
            style={highlightedStyle}
            handlers={handlers}
          />
          {tab.options.copyButton && (
            <CopyButton
              text={tab.highlighted.code}
              variant="floating"
              className="absolute right-3 top-3 z-10 text-dk-tab-inactive-foreground"
            />
          )}
        </div>
      </div>
    );
  }

  // Multiple tabs
  return (
    <ClientMultiCode highlighted={highlighted} groupOptions={groupOptions} storage={storage} />
  );
}

function ClientMultiCode({
  highlighted,
  groupOptions,
  storage,
}: {
  highlighted: Map<
    number,
    {
      highlighted: HighlightedCode;
      title: string;
      options: CodeOptions;
      icon: React.ReactNode;
    }
  >;
  groupOptions: CodeOptions;
  storage?: string;
}) {
  const tabs = Array.from(highlighted.values());
  const [storedTitle, setCurrentTitle] = useStateOrLocalStorage(storage, tabs[0].title);
  const current = tabs.find((tab) => tab.title === storedTitle) || tabs[0];
  const handlers = getHandlers(current.options);
  const { background: _background, ...highlightedStyle } = current.highlighted.style;

  return (
    <Tabs
      value={current.title}
      onValueChange={setCurrentTitle}
      className={cn(
        'group border rounded selection:bg-dk-selection selection:text-current border-dk-border overflow-hidden relative flex flex-col max-h-full min-h-0 my-4 gap-0 not-prose',
      )}
    >
      <TabsList
        className={cn(
          'border-b border-dk-border bg-dk-tabs-background w-full h-9 min-h-9 shrink-0',
          'rounded-none p-0 m-0 justify-start items-stretch',
        )}
      >
        {tabs.map(({ icon, title }) => (
          <TabsTrigger
            key={title}
            value={title}
            className={cn(
              'rounded-none transition-colors duration-200 gap-1.5 px-3 font-mono justify-start grow-0',
              'border-r border-dk-border', // right border dividers
              'text-dk-tab-inactive-foreground data-[state=active]:text-dk-tab-active-foreground hover:text-dk-tab-active-foreground', // text
              'data-[state=active]:bg-dk-background/50', // subtle darker background for active
            )}
          >
            <div>{icon}</div>
            <span className="leading-none">{title}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={current.title} className="relative min-h-0 mt-0 flex flex-col">
        <Pre
          code={current.highlighted}
          className="overflow-auto px-0 py-3 m-0 rounded-none !bg-dk-background selection:bg-dk-selection selection:text-current max-h-full flex-1"
          style={highlightedStyle}
          handlers={handlers}
        />
        {groupOptions.copyButton && (
          <CopyButton
            text={current.highlighted.code}
            variant="floating"
            className="absolute right-3 top-3 z-10 text-dk-tab-inactive-foreground"
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

// Re-export types
export type { RawCode };
