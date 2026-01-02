'use client';

import type * as React from 'react';
import { cn } from '@/lib/utils';
import { APICodePanel, type CodeExample } from './api-code-panel';
import type { Language } from './language-selector';

export interface APISectionProps {
  /** Section title (e.g., "Create a customer", "The Customer object") */
  title: string;
  /** Optional anchor id for deep linking */
  id?: string;
  /** Optional description */
  description?: React.ReactNode;
  /** Left column content (parameters, returns, etc.) */
  children: React.ReactNode;
  /** Languages for code panel */
  languages: Language[];
  /** Code examples for the right panel */
  examples: CodeExample[];
  /** Optional external link for code panel */
  externalLink?: string;
  /** Optional code panel title */
  codePanelTitle?: string;
  /** Custom className */
  className?: string;
}

/**
 * Single API section with two-column layout.
 * Docs/params on left, sticky code panel on right.
 */
export function APISection({
  title,
  id,
  description,
  children,
  languages,
  examples,
  externalLink,
  codePanelTitle,
  className,
}: APISectionProps): React.ReactNode {
  return (
    <section id={id} className={cn('py-8 border-b border-border last:border-b-0', className)}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left column: Documentation */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
            {description && (
              <div className="mt-3 text-muted-foreground prose prose-sm dark:prose-invert">
                {description}
              </div>
            )}
          </div>
          {children}
        </div>

        {/* Right column: Code panel */}
        <div className="lg:pl-4">
          <APICodePanel
            languages={languages}
            examples={examples}
            externalLink={externalLink}
            title={codePanelTitle}
            className="max-h-[400px] lg:max-h-none"
          />
        </div>
      </div>
    </section>
  );
}
