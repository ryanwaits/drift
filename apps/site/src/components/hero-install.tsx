'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/ui/docskit';

const CLI_COMMANDS = {
  bun: 'bun add -g @driftdev/cli',
  npm: 'npm install -g @driftdev/cli',
  pnpm: 'pnpm add -g @driftdev/cli',
} as const;

type Manager = keyof typeof CLI_COMMANDS;

export function HeroInstall() {
  const [manager, setManager] = useState<Manager>('bun');

  return (
    <div className="mx-auto max-w-md text-left">
      <div className="mb-2 flex gap-4">
        {(Object.keys(CLI_COMMANDS) as Manager[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setManager(m)}
            className={`font-mono text-xs uppercase tracking-wide transition-colors ${
              manager === m ? 'text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <InstallRow command={CLI_COMMANDS[manager]} />
    </div>
  );
}

function InstallRow({ command }: { command: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card-bg px-4 py-3">
      <span className="truncate font-mono text-sm text-text">
        <span className="text-text-muted">$</span> {command}
      </span>
      <CopyButton
        text={command}
        variant="inline"
        className="shrink-0 rounded-full border border-border p-1.5 text-text-muted hover:text-text"
      />
    </div>
  );
}
