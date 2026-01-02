'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { APIParameterItem, APISection, ParameterList, ResponseBlock } from '@openpkg-ts/ui/docskit';
import type { ReactNode } from 'react';
import {
  buildImportStatement,
  getLanguagesFromExamples,
  specExamplesToCodeExamples,
  specParamToAPIParam,
} from '../../../adapters/spec-to-docskit';
import { formatSchema } from '../../../core/query';

export interface FunctionSectionProps {
  export: SpecExport;
  spec: OpenPkg;
}

/**
 * Function section for use in single-page API reference.
 * Renders an APISection with parameters and returns.
 */
export function FunctionSection({ export: exp, spec }: FunctionSectionProps): ReactNode {
  const sig = exp.signatures?.[0];
  const hasParams = sig?.parameters && sig.parameters.length > 0;

  // Convert spec data to DocsKit format
  const languages = getLanguagesFromExamples(exp.examples);
  const examples = specExamplesToCodeExamples(exp.examples);
  const importStatement = buildImportStatement(exp, spec);

  // Fallback example if none provided
  const displayExamples =
    examples.length > 0
      ? examples
      : [
          {
            languageId: 'typescript',
            code: `${importStatement}\n\n// Usage\n${exp.name}(${sig?.parameters?.map((p) => p.name).join(', ') || ''})`,
            highlightLang: 'ts',
          },
        ];

  const displayLanguages =
    languages.length > 0 ? languages : [{ id: 'typescript', label: 'TypeScript' }];

  return (
    <APISection
      id={exp.id || exp.name}
      title={`${exp.name}()`}
      description={
        <div className="space-y-3">
          {exp.description && <p>{exp.description}</p>}
          <code className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">
            {importStatement}
          </code>
        </div>
      }
      languages={displayLanguages}
      examples={displayExamples}
      codePanelTitle={`${exp.name}()`}
    >
      {/* Parameters */}
      {hasParams && (
        <ParameterList title="Parameters">
          {sig.parameters!.map((param, index) => {
            const apiParam = specParamToAPIParam(param);
            return (
              <APIParameterItem
                key={param.name ?? index}
                name={apiParam.name}
                type={apiParam.type}
                required={apiParam.required}
                description={apiParam.description}
                children={apiParam.children}
              />
            );
          })}
        </ParameterList>
      )}

      {/* Returns */}
      {sig?.returns && (
        <ResponseBlock
          description={
            <span>
              <span className="font-mono text-sm font-medium">
                {formatSchema(sig.returns.schema)}
              </span>
              {sig.returns.description && (
                <span className="ml-2 text-muted-foreground">{sig.returns.description}</span>
              )}
            </span>
          }
          className="mt-6"
        />
      )}

      {/* Type parameters */}
      {exp.typeParameters && exp.typeParameters.length > 0 && (
        <ParameterList title="Type Parameters" className="mt-6">
          {exp.typeParameters.map((tp) => (
            <APIParameterItem
              key={tp.name}
              name={tp.name}
              type={tp.constraint || 'unknown'}
              description={tp.default ? `Default: ${tp.default}` : undefined}
            />
          ))}
        </ParameterList>
      )}
    </APISection>
  );
}
