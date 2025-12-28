'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { cn } from '@doccov/ui/lib/utils';
import { CodeTabs, ImportSection, type CodeTab } from '@doccov/ui/api';
import { ClientDocsKitCode } from '@doccov/ui/docskit';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { buildSignatureString, formatSchema } from '../../core/query';
import { ParameterItem } from './ParameterItem';

export interface InterfacePageProps {
  export: SpecExport;
  spec: OpenPkg;
  /** Custom code example renderer */
  renderExample?: (code: string, filename: string) => React.ReactNode;
}

/**
 * Stripe-style interface/type page with two-column layout.
 * Left: properties, methods. Right: sticky code examples.
 */
export function InterfacePage({
  export: exp,
  spec,
  renderExample,
}: InterfacePageProps): React.ReactNode {
  const [copied, setCopied] = useState(false);

  const properties = exp.members?.filter(
    (m) => m.kind === 'property' || m.kind === 'field' || !m.kind,
  );
  const methods = exp.members?.filter((m) => m.kind === 'method' || m.kind === 'function');
  const hasExamples = exp.examples && exp.examples.length > 0;

  const packageName = spec.meta.name || 'package';
  const importStatement = `import type { ${exp.name} } from '${packageName}'`;

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
                meta: '-c',
              }}
            />
          ),
        };
      })
    : [];

  return (
    <div className="doccov-interface-page not-prose">
      {/* Header: Interface name with copy button */}
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            exp.kind === 'type'
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-green-500/10 text-green-600 dark:text-green-400',
          )}>
            {exp.kind === 'type' ? 'type' : 'interface'}
          </span>
          <h1 className="font-mono text-3xl font-bold text-foreground tracking-tight">
            {exp.name}
          </h1>
          <button
            type="button"
            onClick={handleCopyName}
            className={cn(
              'p-1.5 rounded-md',
              'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              'transition-all cursor-pointer',
            )}
            aria-label="Copy type name"
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

        {/* Deprecated warning */}
        {exp.deprecated && (
          <div className="mt-4 rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
            <strong>Deprecated:</strong> This export is deprecated.
          </div>
        )}
      </header>

      {/* Two-column Stripe-style layout */}
      <div
        className={cn(
          'grid gap-8 xl:gap-12',
          hasExamples ? 'lg:grid-cols-[1fr,minmax(0,420px)]' : 'grid-cols-1',
        )}
      >
        {/* Left column: Import, Extends, Properties, Methods */}
        <div className="min-w-0 space-y-8">
          {/* Import section */}
          <ImportSection importStatement={importStatement} />

          {/* Extends */}
          {exp.extends && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Extends
              </h2>
              <div className="rounded-lg border border-border bg-card/50 p-4">
                <code className="font-mono text-sm text-primary">{exp.extends}</code>
              </div>
            </section>
          )}

          {/* Properties */}
          {properties && properties.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Properties
              </h2>
              <div className="rounded-lg border border-border bg-card/50 divide-y divide-border">
                {properties.map((prop, index) => (
                  <ParameterItem
                    key={prop.name ?? index}
                    param={{
                      name: prop.name,
                      schema: prop.schema,
                      description: prop.description,
                      required: prop.required,
                    }}
                    className="px-4"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Methods */}
          {methods && methods.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Methods
              </h2>
              <div className="rounded-lg border border-border bg-card/50 divide-y divide-border">
                {methods.map((method, index) => {
                  const sig = method.signatures?.[0];
                  const params = sig?.parameters ?? [];
                  const returnType = formatSchema(sig?.returns?.schema);

                  return (
                    <div key={method.name ?? index} className="p-4">
                      <code className="font-mono text-sm text-foreground">
                        <span className="font-medium">{method.name}</span>
                        <span className="text-muted-foreground">(</span>
                        {params.map((p, i) => (
                          <span key={p.name}>
                            {i > 0 && <span className="text-muted-foreground">, </span>}
                            <span className="text-muted-foreground">{p.name}</span>
                            {p.required === false && <span className="text-muted-foreground">?</span>}
                            <span className="text-muted-foreground">: </span>
                            <span className="text-primary">{formatSchema(p.schema)}</span>
                          </span>
                        ))}
                        <span className="text-muted-foreground">): </span>
                        <span className="text-primary">{returnType}</span>
                      </code>
                      {method.description && (
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                          {method.description}
                        </p>
                      )}
                    </div>
                  );
                })}
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
