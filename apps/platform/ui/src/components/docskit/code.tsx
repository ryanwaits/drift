import { type AnnotationHandler, highlight, Pre, type RawCode } from 'codehike/code';

import { cn } from '../../lib/utils';
import { type CodeInfo, flagsToOptions, theme } from './code.config';
import { CopyButton } from './code.copy';
import { getHandlers } from './code.handlers';
import { CodeIcon } from './code.icon';

export async function DocsKitCode(props: {
  codeblock: RawCode;
  handlers?: AnnotationHandler[];
  className?: string;
}): Promise<React.ReactNode> {
  const { codeblock, className, ...rest } = props;
  const group = await toCodeGroup({ codeblocks: [codeblock], ...rest });
  return <SingleCode group={group} className={className} />;
}

export async function SingleCode(props: { group: CodeInfo; className?: string }): Promise<React.ReactNode> {
  const { pre, title, code, icon, options } = props.group.tabs[0];

  const showCopy = options?.copyButton;

  return (
    <div
      className={cn(
        'group rounded overflow-hidden relative border-dk-border flex flex-col border my-4 not-prose',
        props.className,
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
        {pre}
        {showCopy && (
          <CopyButton
            text={code}
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

export async function toCodeGroup(props: {
  codeblocks: RawCode[];
  flags?: string;
  storage?: string;
  handlers?: AnnotationHandler[];
}): Promise<CodeInfo> {
  // Strip leading dash from flags if present (e.g., "-c" -> "c")
  const rawFlags = props.flags?.startsWith('-') ? props.flags.slice(1) : props.flags;
  const groupOptions = flagsToOptions(rawFlags);

  const tabs = await Promise.all(
    props.codeblocks.map(async (tab) => {
      const { flags, title } = extractFlags(tab);
      const tabOptions = flagsToOptions(flags);
      const options = { ...groupOptions, ...tabOptions };

      const highlighted = await highlight({ ...tab, lang: tab.lang || 'txt' }, theme);
      const handlers = getHandlers(options);
      if (props.handlers) {
        handlers.push(...props.handlers);
      }
      const { background: _background, ...highlightedStyle } = highlighted.style;
      return {
        options,
        title,
        code: highlighted.code,
        icon: <CodeIcon title={title} lang={tab.lang} className="opacity-60" />,
        lang: tab.lang,
        pre: (
          <Pre
            code={highlighted}
            className="overflow-auto px-0 py-3 m-0 rounded-none !bg-dk-background selection:bg-dk-selection selection:text-current max-h-full flex-1"
            style={highlightedStyle}
            handlers={handlers}
          />
        ),
      };
    }),
  );

  return {
    storage: props.storage,
    options: groupOptions,
    tabs,
  };
}

/**
 * Extracts flags and title from the metadata of a code block.
 *
 * @example
 * ```typescript
 * const codeblock = { meta: "foo.js -abc" };
 * const { title, flags } = extractFlags(codeblock);
 * console.log(title); // "foo.js"
 * console.log(flags); // "abc"
 * ```
 */
function extractFlags(codeblock: RawCode) {
  const flags = codeblock.meta.split(' ').filter((flag) => flag.startsWith('-'))[0] ?? '';
  const metaWithoutFlags = !flags
    ? codeblock.meta
    : codeblock.meta === flags
      ? ''
      : codeblock.meta.replace(` ${flags}`, '').trim();
  const title = metaWithoutFlags.trim();
  return { title, flags: flags.slice(1) };
}
