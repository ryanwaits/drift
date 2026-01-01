'use client';

import { type HighlightedCode, Pre, highlight } from 'codehike/code';
import { Check, Copy, ExternalLink } from 'lucide-react';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { theme } from '../code.config';
import { getHandlers } from '../code.handlers';
import { CodeBlockSkeleton } from '../code.skeleton';
import { LanguageSelector, type Language } from './language-selector';

export interface CodeExample {
  /** Language identifier */
  languageId: string;
  /** Code content */
  code: string;
  /** Optional syntax highlighting language (defaults to languageId) */
  highlightLang?: string;
}

export interface APICodePanelProps {
  /** Available languages for the selector */
  languages: Language[];
  /** Code examples keyed by language id */
  examples: CodeExample[];
  /** Optional external link (e.g., to API playground) */
  externalLink?: string;
  /** Optional title shown in header */
  title?: string;
  /** Custom className */
  className?: string;
}

/**
 * Right-side sticky code panel for API documentation.
 * Features language dropdown, copy button, and dark bg with syntax highlighting.
 */
export function APICodePanel({
  languages,
  examples,
  externalLink,
  title,
  className,
}: APICodePanelProps): React.ReactNode {
  const [selectedLang, setSelectedLang] = useState(examples[0]?.languageId ?? languages[0]?.id);
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

  const currentExample = examples.find((e) => e.languageId === selectedLang);
  const code = currentExample?.code ?? '';
  const lang = currentExample?.highlightLang ?? currentExample?.languageId ?? 'txt';

  // Highlight code when it changes
  useEffect(() => {
    let cancelled = false;

    highlight(
      {
        value: code,
        lang: lang === 'curl' ? 'bash' : lang,
        meta: '',
      },
      theme,
    ).then((result) => {
      if (!cancelled) {
        setHighlighted(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handlers = getHandlers({ copyButton: false });

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden border border-dk-border',
        'bg-dk-background text-gray-100',
        'sticky top-20',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dk-border bg-dk-tabs-background">
        <div className="flex items-center gap-3">
          {languages.length > 1 && (
            <LanguageSelector
              languages={languages}
              value={selectedLang}
              onChange={setSelectedLang}
              className="[&_button]:bg-white/5 [&_button]:hover:bg-white/10 [&_button]:text-gray-200"
            />
          )}
          {title && <span className="text-sm text-dk-tab-inactive-foreground">{title}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded text-dk-tab-inactive-foreground hover:text-gray-200 transition-colors cursor-pointer"
            aria-label="Copy code"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          {externalLink && (
            <a
              href={externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded text-dk-tab-inactive-foreground hover:text-gray-200 transition-colors"
              aria-label="Open in playground"
            >
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>

      {/* Code content */}
      <div className="overflow-auto max-h-[60vh] lg:max-h-none">
        {highlighted ? (
          <Pre
            code={highlighted}
            className="overflow-auto px-4 py-3 m-0 rounded-none !bg-dk-background selection:bg-dk-selection selection:text-current text-sm"
            style={highlighted.style}
            handlers={handlers}
          />
        ) : (
          <CodeBlockSkeleton lines={code.split('\n').length} />
        )}
      </div>
    </div>
  );
}
