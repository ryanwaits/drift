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
} from '../../../adapters/spec-to-docskit';

export interface EnumSectionProps {
  export: SpecExport;
  spec: OpenPkg;
}

/**
 * Enum section for use in single-page API reference.
 * Renders an APISection with enum members.
 */
export function EnumSection({ export: exp, spec }: EnumSectionProps): ReactNode {
  const members = exp.members ?? [];

  // Convert spec data to DocsKit format
  const languages = getLanguagesFromExamples(exp.examples);
  const examples = specExamplesToCodeExamples(exp.examples);
  const importStatement = buildImportStatement(exp, spec);

  // Build enum definition for fallback example
  const enumDefinition = members.length > 0
    ? `enum ${exp.name} {\n${members.map(m => {
        const value = m.schema !== undefined
          ? typeof m.schema === 'object' && m.schema !== null
            ? ((m.schema as Record<string, unknown>).const ?? (m.schema as Record<string, unknown>).default)
            : m.schema
          : undefined;
        return `  ${m.name}${value !== undefined ? ` = ${JSON.stringify(value)}` : ''},`;
      }).join('\n')}\n}`
    : `enum ${exp.name} { }`;

  const displayExamples = examples.length > 0 ? examples : [{
    languageId: 'typescript',
    code: `${importStatement}\n\n${enumDefinition}`,
    highlightLang: 'ts',
  }];

  const displayLanguages = languages.length > 0 ? languages : [{ id: 'typescript', label: 'TypeScript' }];

  return (
    <APISection
      id={exp.id || exp.name}
      title={`enum ${exp.name}`}
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
      {/* Enum Members */}
      {members.length > 0 && (
        <ParameterList title="Members">
          {members.map((member, index) => {
            const value = member.schema !== undefined
              ? typeof member.schema === 'object' && member.schema !== null
                ? ((member.schema as Record<string, unknown>).const ??
                  (member.schema as Record<string, unknown>).default ??
                  undefined)
                : member.schema
              : undefined;

            return (
              <APIParameterItem
                key={member.name ?? index}
                name={member.name}
                type={value !== undefined ? String(value) : 'auto'}
                description={member.description}
              />
            );
          })}
        </ParameterList>
      )}
    </APISection>
  );
}
