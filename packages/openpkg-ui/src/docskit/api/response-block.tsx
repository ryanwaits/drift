'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface ResponseBlockProps {
  /** Response JSON data */
  data: object;
  /** Optional title (e.g., "Response", "200 OK") */
  title?: string;
  /** Custom className */
  className?: string;
}

/**
 * JSON response preview with syntax highlighting.
 * Displays formatted JSON with copy functionality.
 */
export function ResponseBlock({ data, title, className }: ResponseBlockProps): React.ReactNode {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className={cn('group rounded-lg border border-border overflow-hidden bg-muted/30', className)}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="Copy response"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
      <div className="relative">
        <pre className="p-4 overflow-auto text-sm font-mono leading-relaxed">
          <code>
            <JsonHighlight json={data} />
          </code>
        </pre>
        {!title && (
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-3 right-3 p-1.5 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="Copy response"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Simple JSON syntax highlighting component.
 */
function JsonHighlight({ json, depth = 0 }: { json: unknown; depth?: number }): React.ReactNode {
  const indent = '  '.repeat(depth);
  const nextIndent = '  '.repeat(depth + 1);

  if (json === null) {
    return <span className="text-orange-400">null</span>;
  }

  if (typeof json === 'boolean') {
    return <span className="text-orange-400">{json ? 'true' : 'false'}</span>;
  }

  if (typeof json === 'number') {
    return <span className="text-cyan-400">{json}</span>;
  }

  if (typeof json === 'string') {
    return <span className="text-emerald-400">"{json}"</span>;
  }

  if (Array.isArray(json)) {
    if (json.length === 0) {
      return <span className="text-foreground">[]</span>;
    }

    return (
      <>
        <span className="text-foreground">[</span>
        {'\n'}
        {json.map((item, i) => (
          <React.Fragment key={i}>
            {nextIndent}
            <JsonHighlight json={item} depth={depth + 1} />
            {i < json.length - 1 && <span className="text-foreground">,</span>}
            {'\n'}
          </React.Fragment>
        ))}
        {indent}
        <span className="text-foreground">]</span>
      </>
    );
  }

  if (typeof json === 'object') {
    const entries = Object.entries(json);
    if (entries.length === 0) {
      return <span className="text-foreground">{'{}'}</span>;
    }

    return (
      <>
        <span className="text-foreground">{'{'}</span>
        {'\n'}
        {entries.map(([key, value], i) => (
          <React.Fragment key={key}>
            {nextIndent}
            <span className="text-blue-400">"{key}"</span>
            <span className="text-foreground">: </span>
            <JsonHighlight json={value} depth={depth + 1} />
            {i < entries.length - 1 && <span className="text-foreground">,</span>}
            {'\n'}
          </React.Fragment>
        ))}
        {indent}
        <span className="text-foreground">{'}'}</span>
      </>
    );
  }

  return <span className="text-foreground">{String(json)}</span>;
}
