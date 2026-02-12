'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ClientDocsKitCode } from './code.client-highlight';

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

export function PackageInstall({
  package: pkg,
  dev = false,
  global: isGlobal = false,
  managers = ['npm', 'bun', 'pnpm', 'yarn'],
  copyButton = true,
}: PackageInstallProps): React.ReactNode {
  const [activeManager, setActiveManager] = useState<PackageManager>(managers[0]);
  const command = getInstallCommand(activeManager, pkg, { dev, global: isGlobal });

  return (
    <div className="group rounded overflow-hidden border border-openpkg-code-border flex flex-col my-4 not-prose">
      <div
        className={cn(
          'border-b border-openpkg-code-border bg-openpkg-code-header',
          'w-full h-9 flex items-center px-3 gap-2 shrink-0',
        )}
      >
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
        </div>

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
                  ? 'bg-openpkg-code-bg border-openpkg-code-border text-openpkg-code-text-active'
                  : 'border-transparent text-openpkg-code-text-inactive hover:text-openpkg-code-text-active',
              )}
            >
              {managerLabels[manager]}
            </button>
          ))}
        </div>

        <span className="sr-only">Terminal window</span>
      </div>

      <ClientDocsKitCode
        codeblock={{
          value: command,
          lang: 'bash',
          meta: copyButton ? '-c' : '',
        }}
        className="!my-0 !border-0 !rounded-none"
        fallback={command}
      />
    </div>
  );
}
