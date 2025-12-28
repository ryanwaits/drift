'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { cn } from '@doccov/ui/lib/utils';
import { CodeTabs, ImportSection, type CodeTab } from '@doccov/ui/api';
import { ClientDocsKitCode } from '@doccov/ui/docskit';
import { Check, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { formatSchema } from '../../core/query';
import { ParameterItem } from './ParameterItem';

export interface FunctionPageProps {
  export: SpecExport;
  spec: OpenPkg;
  /** Custom code example renderer */
  renderExample?: (code: string, filename: string) => ReactNode;
}

/**
 * Stripe-style function page with two-column layout.
 * Left: parameters, returns. Right: sticky code examples.
 */
export function FunctionPage({
  export: exp,
  spec,
  renderExample,
}: FunctionPageProps): ReactNode {
  const [copied, setCopied] = useState(false);
  const sig = exp.signatures?.[0];
  const hasExamples = exp.examples && exp.examples.length > 0;
  const hasParams = sig?.parameters && sig.parameters.length > 0;

  // Build import statement
  const packageName = spec.meta.name || 'package';
  const importStatement = `import { ${exp.name} } from '${packageName}'`;

  // Copy function name
  const handleCopyName = () => {
    navigator.clipboard.writeText(exp.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  // Build code tabs from examples
  const codeTabs: CodeTab[] = hasExamples
    ? exp.examples!.map((example, index) => {
        const code = typeof example === 'string' ? example : example.code;
        const title =
          typeof example === 'string'
            ? `Example ${index + 1}`
            : example.title || `Example ${index + 1}`;
        const filename = `${exp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${index + 1}.ts`;

        // Detect language from example or default to typescript
        const lang = typeof example === 'string' ? 'ts' : example.language || 'ts';

        return {
          label: title,
          code,
          content: renderExample ? (
            renderExample(code, filename)
          ) : (
            <ClientDocsKitCode
              codeblock={{
                value: code,
                lang,
                meta: '-c', // copy button enabled
              }}
            />
          ),
        };
      })
    : [];

  return (
    <div className="doccov-function-page not-prose">
      {/* Header: Function name with copy button */}
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-3xl font-bold text-foreground tracking-tight">
            {exp.name}
            <span className="text-muted-foreground font-normal">()</span>
          </h1>
          <button
            type="button"
            onClick={handleCopyName}
            className={cn(
              'p-1.5 rounded-md',
              'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              'transition-all cursor-pointer',
            )}
            aria-label="Copy function name"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>

        {/* Description */}
        {exp.description && (
          <p className="mt-4 text-muted-foreground leading-relaxed text-base max-w-2xl">
            {exp.description}
          </p>
        )}
      </header>

      {/* Two-column Stripe-style layout */}
      <div
        className={cn(
          'grid gap-8 xl:gap-12',
          hasExamples ? 'lg:grid-cols-[1fr,minmax(0,420px)]' : 'grid-cols-1',
        )}
      >
        {/* Left column: Import, Parameters & Returns */}
        <div className="min-w-0 space-y-8">
          {/* Import section */}
          <ImportSection importStatement={importStatement} />

          {/* Parameters */}
          {hasParams && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Parameters
              </h2>
              <div className="rounded-lg border border-border bg-card/50 divide-y divide-border">
                {sig.parameters!.map((param, index) => (
                  <ParameterItem
                    key={param.name ?? index}
                    param={param}
                    className="px-4"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Returns */}
          {sig?.returns && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Returns
              </h2>
              <div className="rounded-lg border border-border bg-card/50 p-4">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {formatSchema(sig.returns.schema)}
                  </span>
                </div>
                {sig.returns.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {sig.returns.description}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Right column: Sticky code examples */}
        {hasExamples && (
          <aside className="lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            {codeTabs.length === 1 ? (
              <div className="rounded-lg border border-border overflow-hidden bg-background">
                {codeTabs[0].content}
              </div>
            ) : (
              <CodeTabs tabs={codeTabs} sticky />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
