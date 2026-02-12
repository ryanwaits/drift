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
import { useStateOrLocalStorage } from '@/hooks/use-local-storage';
import { cn } from '@/lib/utils';
import { type CodeOptions, extractFlags, extractFlagsOnly, flagsToOptions, PRE_CLASSNAME, theme } from './code.config';
import { CodeHeader } from './code-header';
import { CopyButton } from './code.copy';
import { getHandlers } from './code.handlers';
import { CodeIcon } from './code.icon';
import {
  CodeBlockSkeleton,
  CodeTabsSkeleton,
  InlineCodeSkeleton,
  TerminalSkeleton,
} from './code.skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Client-side code block with syntax highlighting.
 */
export function ClientDocsKitCode(props: {
  codeblock: RawCode;
  handlers?: AnnotationHandler[];
  className?: string;
  fallback?: string;
}): React.ReactNode {
  const { codeblock, handlers: extraHandlers, className: wrapperClassName, fallback } = props;
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
  }, [codeblock.value, codeblock.lang, codeblock.meta, codeblock]);

  if (!highlighted) {
    if (fallback) {
      return (
        <div className={cn('rounded overflow-hidden relative border-openpkg-code-border flex flex-col border my-4 not-prose', wrapperClassName)}>
          <CodeHeader title={title} icon={null} />
          <pre className={PRE_CLASSNAME}>
            <code className="px-4 block text-openpkg-code-text-active">{fallback}</code>
          </pre>
        </div>
      );
    }
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
        'group rounded overflow-hidden relative border-openpkg-code-border flex flex-col border my-4 not-prose',
        wrapperClassName,
      )}
    >
      <CodeHeader title={title} icon={icon} />
      <div className="relative flex items-start">
        <Pre
          code={highlighted}
          className={PRE_CLASSNAME}
          style={highlightedStyle}
          handlers={handlers}
        />
        {showCopy && (
          <CopyButton
            text={highlighted.code}
            variant="floating"
            className={cn('absolute right-3 z-10 text-openpkg-code-text-inactive', 'top-3')}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Client-side terminal-style code block.
 */
export function ClientTerminal(props: {
  codeblock: RawCode;
  handlers?: AnnotationHandler[];
}): React.ReactNode {
  const { codeblock, handlers: extraHandlers } = props;
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

  const flags = extractFlagsOnly(codeblock);
  const options = flagsToOptions(flags);

  useEffect(() => {
    let cancelled = false;

    highlight({ ...codeblock, lang: codeblock.lang || 'bash' }, theme).then((result) => {
      if (!cancelled) setHighlighted(result);
    });

    return () => {
      cancelled = true;
    };
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
    <div className="group rounded overflow-hidden relative border-openpkg-code-border flex flex-col border my-4 not-prose">
      <div
        className={cn(
          'border-b border-openpkg-code-border bg-openpkg-code-header',
          'w-full h-9 flex items-center justify-center shrink-0',
          'relative',
        )}
      >
        <div className="absolute left-3 flex items-center gap-2">
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
        </div>
        <span className="sr-only">Terminal window</span>
      </div>

      <div className="relative flex items-start">
        <Pre
          code={highlighted}
          className={PRE_CLASSNAME}
          style={highlightedStyle}
          handlers={handlers}
        />
        {showCopy && (
          <CopyButton
            text={highlighted.code}
            variant="floating"
            className={cn(
              'absolute right-3 z-10 text-openpkg-code-text-inactive',
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
export function ClientInlineCode({ codeblock }: { codeblock: RawCode }): React.ReactNode {
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

  useEffect(() => {
    let cancelled = false;

    highlight(codeblock, theme).then((result) => {
      if (!cancelled) setHighlighted(result);
    });

    return () => {
      cancelled = true;
    };
  }, [codeblock.value, codeblock.lang, codeblock.meta, codeblock]);

  if (!highlighted) {
    return <InlineCodeSkeleton />;
  }

  return (
    <Inline
      code={highlighted}
      className="selection:bg-openpkg-code-selection selection:text-current rounded border border-openpkg-code-border px-1 py-0.5 whitespace-nowrap !bg-openpkg-code-bg"
      style={highlighted.style}
    />
  );
}

/**
 * Client-side code tabs with multiple files.
 */
export function ClientCode(props: {
  codeblocks: RawCode[];
  flags?: string;
  storage?: string;
}): React.ReactNode {
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
  }, [codeblocks.map, groupOptions]);

  if (!highlighted) {
    return <CodeTabsSkeleton tabs={codeblocks.length} />;
  }

  if (codeblocks.length === 1) {
    const tab = highlighted.get(0);
    if (!tab) return <CodeTabsSkeleton tabs={1} />;
    const handlers = getHandlers(tab.options);
    const { background: _background, ...highlightedStyle } = tab.highlighted.style;

    return (
      <div className="group rounded overflow-hidden relative border-openpkg-code-border flex flex-col border my-4 not-prose">
        <CodeHeader title={tab.title} icon={tab.icon} />
        <div className="relative flex items-start">
          <Pre
            code={tab.highlighted}
            className={PRE_CLASSNAME}
            style={highlightedStyle}
            handlers={handlers}
          />
          {tab.options.copyButton && (
            <CopyButton
              text={tab.highlighted.code}
              variant="floating"
              className="absolute right-3 top-3 z-10 text-openpkg-code-text-inactive"
            />
          )}
        </div>
      </div>
    );
  }

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
        'group border rounded selection:bg-openpkg-code-selection selection:text-current border-openpkg-code-border overflow-hidden relative flex flex-col max-h-full min-h-0 my-4 gap-0 not-prose',
      )}
    >
      <TabsList
        className={cn(
          'border-b border-openpkg-code-border bg-openpkg-code-header w-full h-9 min-h-9 shrink-0',
          'rounded-none p-0 m-0 justify-start items-stretch',
        )}
      >
        {tabs.map(({ icon, title }) => (
          <TabsTrigger
            key={title}
            value={title}
            className={cn(
              'rounded-none transition-colors duration-200 gap-1.5 px-3 font-mono justify-start grow-0',
              'border-r border-openpkg-code-border',
              'text-openpkg-code-text-inactive data-[state=active]:text-openpkg-code-text-active hover:text-openpkg-code-text-active',
              'data-[state=active]:bg-openpkg-code-bg/50',
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
          className={PRE_CLASSNAME}
          style={highlightedStyle}
          handlers={handlers}
        />
        {groupOptions.copyButton && (
          <CopyButton
            text={current.highlighted.code}
            variant="floating"
            className="absolute right-3 top-3 z-10 text-openpkg-code-text-inactive"
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

export type { RawCode };
