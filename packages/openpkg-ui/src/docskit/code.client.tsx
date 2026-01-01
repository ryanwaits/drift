'use client';

import { useStateOrLocalStorage } from '@/hooks/use-locale-storage';
import { cn } from '@/lib/utils';
import type { CodeInfo } from './code.config';
import { CopyButton } from './code.copy';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

export function MultiCode({ group, className }: { group: CodeInfo; className?: string }) {
  const [storedTitle, setCurrentTitle] = useStateOrLocalStorage(group.storage, group.tabs[0].title);
  const current = group.tabs.find((tab) => tab.title === storedTitle) || group.tabs[0];

  const { code } = current;
  const currentTitle = current?.title;

  return (
    <Tabs
      value={currentTitle}
      onValueChange={setCurrentTitle}
      className={cn(
        'group border rounded selection:bg-dk-selection selection:text-current border-dk-border overflow-hidden relative flex flex-col max-h-full min-h-0 my-4 gap-0 not-prose',
        className,
      )}
    >
      <TabsList
        className={cn(
          'border-b border-dk-border bg-dk-tabs-background w-full h-9 min-h-9 shrink-0',
          'rounded-none p-0 m-0 justify-start items-stretch',
        )}
      >
        {group.tabs.map(({ icon, title }, _index) => (
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
        {current.pre}
        {group.options.copyButton && (
          <CopyButton
            text={code}
            variant="floating"
            className="absolute right-3 top-3 z-10 text-dk-tab-inactive-foreground"
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
