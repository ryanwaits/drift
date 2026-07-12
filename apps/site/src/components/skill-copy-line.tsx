'use client';

import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export function SkillCopyLine({ command }: { command: string }) {
  const [copied, copy] = useCopyToClipboard();

  return (
    <button
      type="button"
      onClick={() => copy(command)}
      className="group border-0 bg-transparent p-0 font-sans text-text-muted underline-offset-2 transition-colors hover:text-text hover:underline hover:decoration-text"
    >
      {command}
      {copied ? (
        <Check size={13} className="ml-1.5 inline-block align-text-bottom text-text-muted" />
      ) : (
        <Copy
          size={13}
          className="ml-1.5 inline-block align-text-bottom text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
        />
      )}
    </button>
  );
}
