'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { ClientDocsKitCode } from '@doccov/ui/docskit';
import { buildSignatureString } from '../../core/query';

export interface EnumPageProps {
  export: SpecExport;
  spec: OpenPkg;
  /** Custom code example renderer */
  renderExample?: (code: string, filename: string) => React.ReactNode;
}

/**
 * Styled enum page component with Tailwind.
 */
export function EnumPage({ export: exp, spec, renderExample }: EnumPageProps): React.ReactNode {
  const members = exp.members ?? [];
  const hasExamples = exp.examples && exp.examples.length > 0;
  const signature = buildSignatureString(exp);

  return (
    <div className="space-y-6">
      {/* Description */}
      {exp.description && (
        <p className="text-muted-foreground text-base leading-relaxed">{exp.description}</p>
      )}

      {/* Declaration */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Declaration</h2>
        <div className="rounded-lg border border-border bg-muted/30 p-4 overflow-x-auto">
          <code className="font-mono text-sm text-foreground">{signature}</code>
        </div>
        {exp.deprecated && (
          <div className="mt-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
            <strong>Deprecated:</strong> This export is deprecated.
          </div>
        )}
      </section>

      {/* Enum Members */}
      {members.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Members</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Value</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => {
                  const value =
                    member.schema !== undefined
                      ? typeof member.schema === 'object' && member.schema !== null
                        ? ((member.schema as Record<string, unknown>).const ??
                          (member.schema as Record<string, unknown>).default ??
                          '-')
                        : member.schema
                      : '-';

                  return (
                    <tr key={member.name ?? index} className="border-b border-border last:border-0">
                      <td className="py-2 px-3 align-top">
                        <code className="text-primary font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">
                          {member.name}
                        </code>
                      </td>
                      <td className="py-2 px-3 align-top">
                        <code className="font-mono text-xs text-muted-foreground">
                          {String(value)}
                        </code>
                      </td>
                      <td className="py-2 px-3 align-top text-muted-foreground">
                        {member.description ?? ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Examples */}
      {hasExamples && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Examples</h2>
          {exp.examples!.map((example, index) => {
            const code = typeof example === 'string' ? example : example.code;
            return (
              <div key={index} className="mb-4">
                {renderExample ? (
                  renderExample(code, `${exp.name.toLowerCase()}-${index}.ts`)
                ) : (
                  <ClientDocsKitCode
                    codeblock={{
                      value: code,
                      lang: 'ts',
                      meta: '-c',
                    }}
                  />
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
