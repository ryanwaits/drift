'use client';

import type { ComponentProps, ReactNode } from 'react';
import { CopyButton } from '@/components/ui/docskit';

function extractText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractText((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

export function DocsCodeBlock({ children, ...props }: ComponentProps<'pre'>) {
  const code = extractText(children).replace(/\n$/, '');

  return (
    <div className="group relative my-5">
      <pre
        className="overflow-x-auto rounded-lg border border-border bg-code-bg p-4 leading-relaxed"
        {...props}
      >
        {children}
      </pre>
      <CopyButton
        text={code}
        variant="floating"
        className="absolute top-3 right-3 z-10 text-text-muted"
      />
    </div>
  );
}
