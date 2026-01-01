'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CopyButton } from './code.copy';

type PackageManager = 'npm' | 'bun' | 'pnpm' | 'yarn';

interface PackageInstallProps {
  /** The package name to install */
  package: string;
  /** Whether this is a dev dependency */
  dev?: boolean;
  /** Whether this is a global install */
  global?: boolean;
  /** Which package managers to show (defaults to all) */
  managers?: PackageManager[];
  /** Whether to show the copy button */
  copyButton?: boolean;
}

const managerLabels: Record<PackageManager, string> = {
  npm: 'npm',
  bun: 'bun',
  pnpm: 'pnpm',
  yarn: 'yarn',
};

function getInstallCommand(
  manager: PackageManager,
  pkg: string,
  options: { dev?: boolean; global?: boolean },
): string {
  const { dev, global: isGlobal } = options;

  if (isGlobal) {
    switch (manager) {
      case 'npm':
        return `npm install -g ${pkg}`;
      case 'bun':
        return `bun install -g ${pkg}`;
      case 'pnpm':
        return `pnpm install -g ${pkg}`;
      case 'yarn':
        return `yarn global add ${pkg}`;
    }
  }

  if (dev) {
    switch (manager) {
      case 'npm':
        return `npm install -D ${pkg}`;
      case 'bun':
        return `bun add -d ${pkg}`;
      case 'pnpm':
        return `pnpm add -D ${pkg}`;
      case 'yarn':
        return `yarn add -D ${pkg}`;
    }
  }

  switch (manager) {
    case 'npm':
      return `npm install ${pkg}`;
    case 'bun':
      return `bun add ${pkg}`;
    case 'pnpm':
      return `pnpm add ${pkg}`;
    case 'yarn':
      return `yarn add ${pkg}`;
  }
}

/**
 * Package installation command with tabs for different package managers.
 *
 * @example
 * ```tsx
 * <PackageInstall package="@doccov/ui" />
 * <PackageInstall package="typescript" dev />
 * <PackageInstall package="opencode-ai" global />
 * ```
 */
export function PackageInstall({
  package: pkg,
  dev = false,
  global: isGlobal = false,
  managers = ['npm', 'bun', 'pnpm', 'yarn'],
  copyButton = true,
}: PackageInstallProps) {
  const [activeManager, setActiveManager] = useState<PackageManager>(managers[0]);
  const command = getInstallCommand(activeManager, pkg, { dev, global: isGlobal });

  return (
    <div className="group rounded overflow-hidden border border-dk-border flex flex-col my-4 not-prose">
      {/* Header with macOS dots and package manager tabs */}
      <div
        className={cn(
          'border-b border-dk-border bg-dk-tabs-background',
          'w-full h-9 flex items-center px-3 gap-2 shrink-0',
        )}
      >
        {/* macOS window controls (3 dots) */}
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-dk-tab-inactive-foreground/30" />
          <div className="size-3 rounded-full bg-dk-tab-inactive-foreground/30" />
          <div className="size-3 rounded-full bg-dk-tab-inactive-foreground/30" />
        </div>

        {/* Package manager tabs as pill buttons */}
        <div className="flex items-center gap-0.5 ml-1">
          {managers.map((manager) => (
            <button
              type="button"
              key={manager}
              onClick={() => setActiveManager(manager)}
              className={cn(
                'px-2 py-0.5 text-sm font-medium rounded-md transition-colors duration-200',
                'border h-6',
                activeManager === manager
                  ? 'bg-dk-background border-dk-border text-dk-tab-active-foreground'
                  : 'border-transparent text-dk-tab-inactive-foreground hover:text-dk-tab-active-foreground',
              )}
            >
              {managerLabels[manager]}
            </button>
          ))}
        </div>

        <span className="sr-only">Terminal window</span>
      </div>

      {/* Command content */}
      <div className="relative flex items-start bg-dk-background">
        <pre className="overflow-auto px-3 py-3 m-0 font-mono text-sm flex-1">
          <code>
            <span className="text-ch-5">{command.split(' ')[0]}</span>
            <span className="text-ch-0"> {command.split(' ').slice(1).join(' ')}</span>
          </code>
        </pre>
        {copyButton && (
          <CopyButton
            text={command}
            variant="floating"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-dk-tab-inactive-foreground"
          />
        )}
      </div>
    </div>
  );
}
