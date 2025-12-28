'use client';

import type { OpenPkg, SpecExport, SpecMember } from '@openpkg-ts/spec';
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
  specSchemaToAPISchema,
} from '../../../adapters/spec-to-docskit';
import { formatSchema } from '../../../core/query';

export interface InterfaceSectionProps {
  export: SpecExport;
  spec: OpenPkg;
}

/** Format method signature for display */
function formatMethodSignature(member: SpecMember): string {
  const sig = member.signatures?.[0];
  const params = sig?.parameters ?? [];
  const returnType = formatSchema(sig?.returns?.schema);
  const paramStr = params
    .map((p) => `${p.name}${p.required === false ? '?' : ''}: ${formatSchema(p.schema)}`)
    .join(', ');
  return `(${paramStr}): ${returnType}`;
}

/**
 * Interface/type section for use in single-page API reference.
 * Renders an APISection with properties and methods.
 */
export function InterfaceSection({
  export: exp,
  spec,
}: InterfaceSectionProps): ReactNode {
  const properties = exp.members?.filter(
    (m) => m.kind === 'property' || m.kind === 'field' || !m.kind,
  ) ?? [];
  const methods = exp.members?.filter(
    (m) => m.kind === 'method' || m.kind === 'function',
  ) ?? [];

  // Convert spec data to DocsKit format
  const languages = getLanguagesFromExamples(exp.examples);
  const examples = specExamplesToCodeExamples(exp.examples);
  const importStatement = buildImportStatement(exp, spec);

  // Build type definition for fallback example
  const typeDefinition = properties.length > 0
    ? `${exp.kind === 'type' ? 'type' : 'interface'} ${exp.name} {\n${properties.map(p => `  ${p.name}${p.required === false ? '?' : ''}: ${formatSchema(p.schema)};`).join('\n')}\n}`
    : `${exp.kind === 'type' ? 'type' : 'interface'} ${exp.name} { }`;

  const displayExamples = examples.length > 0 ? examples : [{
    languageId: 'typescript',
    code: `${importStatement}\n\n${typeDefinition}`,
    highlightLang: 'ts',
  }];

  const displayLanguages = languages.length > 0 ? languages : [{ id: 'typescript', label: 'TypeScript' }];

  const kindLabel = exp.kind === 'type' ? 'type' : 'interface';

  return (
    <APISection
      id={exp.id || exp.name}
      title={`${kindLabel} ${exp.name}`}
      description={
        <div className="space-y-3">
          {exp.extends && (
            <p className="font-mono text-sm text-muted-foreground">
              extends {exp.extends}
            </p>
          )}
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
      {/* Properties */}
      {properties.length > 0 && (
        <ParameterList title="Properties">
          {properties.map((prop, index) => {
            const type = formatSchema(prop.schema);
            const children = specSchemaToAPISchema(prop.schema);
            const hasNestedProperties = children?.properties && Object.keys(children.properties).length > 0;

            return (
              <APIParameterItem
                key={prop.name ?? index}
                name={prop.name}
                type={type}
                required={prop.required !== false}
                description={prop.description}
                children={hasNestedProperties ? children : undefined}
              />
            );
          })}
        </ParameterList>
      )}

      {/* Methods */}
      {methods.length > 0 && (
        <ParameterList title="Methods" className="mt-6">
          {methods.map((method, index) => (
            <APIParameterItem
              key={method.name ?? index}
              name={`${method.name}()`}
              type={formatMethodSignature(method)}
              description={method.description}
            />
          ))}
        </ParameterList>
      )}
    </APISection>
  );
}
