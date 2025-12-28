'use client';

import type { OpenPkg, SpecExport, SpecMember } from '@openpkg-ts/spec';
import { cn } from '@doccov/ui/lib/utils';
import { CodeTabs, ImportSection, type CodeTab } from '@doccov/ui/api';
import { ClientDocsKitCode } from '@doccov/ui/docskit';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { formatSchema } from '../../core/query';
import { ParameterItem } from './ParameterItem';

export interface ClassPageProps {
  export: SpecExport;
  spec: OpenPkg;
  /** Custom code example renderer */
  renderExample?: (code: string, filename: string) => React.ReactNode;
}

function PropertyItem({ member }: { member: SpecMember }) {
  const visibility = member.visibility ?? 'public';
  const flags = member.flags as Record<string, boolean> | undefined;
  const isStatic = flags?.static;
  const isReadonly = flags?.readonly;
  const type = formatSchema(member.schema);

  return (
    <div className="py-4 first:pt-4 last:pb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <code className="font-mono text-sm font-medium text-foreground">{member.name}</code>
        <code className="font-mono text-sm text-primary">{type}</code>
        {visibility !== 'public' && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {visibility}
          </span>
        )}
        {isStatic && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
            static
          </span>
        )}
        {isReadonly && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">
            readonly
          </span>
        )}
      </div>
      {member.description && (
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{member.description}</p>
      )}
    </div>
  );
}

function MethodItem({ member }: { member: SpecMember }) {
  const sig = member.signatures?.[0];
  const params = sig?.parameters ?? [];
  const returnType = formatSchema(sig?.returns?.schema);
  const visibility = member.visibility ?? 'public';
  const flags = member.flags as Record<string, boolean> | undefined;
  const isStatic = flags?.static;
  const isAsync = flags?.async;

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {visibility !== 'public' && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {visibility}
          </span>
        )}
        {isStatic && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
            static
          </span>
        )}
        {isAsync && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-medium">
            async
          </span>
        )}
      </div>
      <code className="font-mono text-sm text-foreground">
        <span className="font-medium">{member.name}</span>
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
      {member.description && (
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{member.description}</p>
      )}
    </div>
  );
}

/**
 * Stripe-style class page with two-column layout.
 * Left: constructor, methods, properties. Right: sticky code examples.
 */
export function ClassPage({ export: exp, spec, renderExample }: ClassPageProps): React.ReactNode {
  const [copied, setCopied] = useState(false);
  const hasExamples = exp.examples && exp.examples.length > 0;

  const constructors = exp.members?.filter((m) => m.kind === 'constructor') ?? [];
  const properties = exp.members?.filter((m) => m.kind === 'property' || m.kind === 'field') ?? [];
  const methods = exp.members?.filter((m) => m.kind === 'method') ?? [];

  // Separate static and instance members
  const staticProperties = properties.filter((m) => (m.flags as Record<string, boolean>)?.static);
  const instanceProperties = properties.filter((m) => !(m.flags as Record<string, boolean>)?.static);
  const staticMethods = methods.filter((m) => (m.flags as Record<string, boolean>)?.static);
  const instanceMethods = methods.filter((m) => !(m.flags as Record<string, boolean>)?.static);

  const constructorSig = constructors[0]?.signatures?.[0];
  const constructorParams = constructorSig?.parameters ?? [];

  const packageName = spec.meta.name || 'package';
  const importStatement = `import { ${exp.name} } from '${packageName}'`;

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
    <div className="doccov-class-page not-prose">
      {/* Header: Class name with copy button */}
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400">
            class
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
            aria-label="Copy class name"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>

        {/* Extends/Implements */}
        {(exp.extends || exp.implements?.length) && (
          <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
            {exp.extends && (
              <>
                <span className="text-muted-foreground">extends</span>
                <code className="font-mono text-primary">{exp.extends}</code>
              </>
            )}
            {exp.implements?.length && (
              <>
                <span className="text-muted-foreground">implements</span>
                <code className="font-mono text-primary">{exp.implements.join(', ')}</code>
              </>
            )}
          </div>
        )}

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
        {/* Left column */}
        <div className="min-w-0 space-y-8">
          {/* Import section */}
          <ImportSection importStatement={importStatement} />

          {/* Constructor */}
          {constructorParams.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Constructor
              </h2>
              <div className="rounded-lg border border-border bg-card/50 divide-y divide-border">
                {constructorParams.map((param, index) => (
                  <ParameterItem
                    key={param.name ?? index}
                    param={param}
                    className="px-4"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Static Members */}
          {(staticProperties.length > 0 || staticMethods.length > 0) && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Static Members
              </h2>
              <div className="rounded-lg border border-border bg-card/50 divide-y divide-border">
                {staticProperties.map((member, index) => (
                  <PropertyItem key={member.name ?? `prop-${index}`} member={member} />
                ))}
                {staticMethods.map((member, index) => (
                  <MethodItem key={member.name ?? `method-${index}`} member={member} />
                ))}
              </div>
            </section>
          )}

          {/* Instance Methods */}
          {instanceMethods.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Methods
              </h2>
              <div className="rounded-lg border border-border bg-card/50 divide-y divide-border">
                {instanceMethods.map((member, index) => (
                  <MethodItem key={member.name ?? index} member={member} />
                ))}
              </div>
            </section>
          )}

          {/* Instance Properties */}
          {instanceProperties.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Properties
              </h2>
              <div className="rounded-lg border border-border bg-card/50 divide-y divide-border px-4">
                {instanceProperties.map((member, index) => (
                  <PropertyItem key={member.name ?? index} member={member} />
                ))}
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
