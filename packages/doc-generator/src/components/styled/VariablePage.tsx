'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { ClientDocsKitCode } from '@doccov/ui/docskit';
import { formatSchema } from '../../core/query';

export interface VariablePageProps {
  export: SpecExport;
  spec: OpenPkg;
  /** Custom code example renderer */
  renderExample?: (code: string, filename: string) => React.ReactNode;
}

/**
 * Styled variable/constant page component with Tailwind.
 */
export function VariablePage({
  export: exp,
  spec,
  renderExample,
}: VariablePageProps): React.ReactNode {
  const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);
  const hasExamples = exp.examples && exp.examples.length > 0;

  const exampleCode = hasExamples
    ? typeof exp.examples![0] === 'string'
      ? exp.examples![0]
      : exp.examples![0].code
    : '';

  return (
    <div className="space-y-8">
      {/* Description */}
      {exp.description && (
        <p className="text-muted-foreground text-lg leading-relaxed">{exp.description}</p>
      )}

      {/* Declaration */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 overflow-x-auto">
        <code className="font-mono text-sm text-foreground whitespace-pre">
          const {exp.name}: {typeValue}
        </code>
      </div>
      {exp.deprecated && (
        <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
          <strong>Deprecated:</strong> This export is deprecated.
        </div>
      )}

      {/* Two-column layout */}
      <div className={`grid gap-8 ${hasExamples ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Left column: Type info */}
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Type
            </h3>
            <div className="rounded-lg border border-border bg-card p-4">
              <code className="font-mono text-sm text-primary">{typeValue}</code>
            </div>
          </div>
        </div>

        {/* Right column: Examples */}
        {hasExamples && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {exp.name} usage
            </h3>
            {renderExample ? (
              renderExample(exampleCode, `${exp.name.toLowerCase()}.ts`)
            ) : (
              <ClientDocsKitCode
                codeblock={{
                  value: exampleCode,
                  lang: 'ts',
                  meta: '-c',
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
