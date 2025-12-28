'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import {
  APIParameterItem,
  APISection,
  ParameterList,
} from '@doccov/ui/docskit';
import type { ReactNode } from 'react';
import {
  buildImportStatement,
  getLanguagesFromExamples,
  specExamplesToCodeExamples,
} from '../../adapters/spec-to-docskit';
import { formatSchema } from '../../core/query';

export interface VariablePageProps {
  export: SpecExport;
  spec: OpenPkg;
}

/**
 * Stripe-style variable/constant page with two-column layout.
 */
export function VariablePage({
  export: exp,
  spec,
}: VariablePageProps): ReactNode {
  const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);

  // Convert spec data to DocsKit format
  const languages = getLanguagesFromExamples(exp.examples);
  const examples = specExamplesToCodeExamples(exp.examples);
  const importStatement = buildImportStatement(exp, spec);

  // Get const value if available
  const constValue = exp.schema && typeof exp.schema === 'object'
    ? (exp.schema as Record<string, unknown>).const
    : undefined;

  const displayExamples = examples.length > 0 ? examples : [{
    languageId: 'typescript',
    code: `${importStatement}\n\nconsole.log(${exp.name}); // ${constValue !== undefined ? JSON.stringify(constValue) : typeValue}`,
    highlightLang: 'ts',
  }];

  const displayLanguages = languages.length > 0 ? languages : [{ id: 'typescript', label: 'TypeScript' }];

  return (
    <div className="doccov-variable-page not-prose">
      <APISection
        id={exp.id || exp.name}
        title={`const ${exp.name}`}
        description={
          <div className="space-y-3">
            {exp.description && <p>{exp.description}</p>}
            {exp.deprecated && (
              <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
                <strong>Deprecated:</strong> This export is deprecated.
              </div>
            )}
            <code className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">
              {importStatement}
            </code>
          </div>
        }
        languages={displayLanguages}
        examples={displayExamples}
        codePanelTitle={exp.name}
      >
        <ParameterList title="Type">
          <APIParameterItem
            name={exp.name}
            type={typeValue}
            description={constValue !== undefined ? `Value: ${JSON.stringify(constValue)}` : undefined}
          />
        </ParameterList>
      </APISection>
    </div>
  );
}
