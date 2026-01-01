'use client';

import type { OpenPkg, SpecExport, SpecMember } from '@openpkg-ts/spec';
import {
  APIParameterItem,
  APISection,
  ParameterList,
} from '@openpkg-ts/ui/docskit';
import type { ReactNode } from 'react';
import {
  buildImportStatement,
  getLanguagesFromExamples,
  specExamplesToCodeExamples,
  specParamToAPIParam,
} from '../../../adapters/spec-to-docskit';
import { formatSchema } from '../../../core/query';

export interface ClassSectionProps {
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

/** Get visibility/modifier badges as a string */
function getMemberBadges(member: SpecMember): string[] {
  const badges: string[] = [];
  const flags = member.flags as Record<string, boolean> | undefined;

  if (member.visibility && member.visibility !== 'public') {
    badges.push(member.visibility);
  }
  if (flags?.static) badges.push('static');
  if (flags?.readonly) badges.push('readonly');
  if (flags?.async) badges.push('async');

  return badges;
}

/**
 * Class section for use in single-page API reference.
 * Renders an APISection with constructor, methods, and properties.
 */
export function ClassSection({ export: exp, spec }: ClassSectionProps): ReactNode {
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

  // Convert spec data to DocsKit format
  const languages = getLanguagesFromExamples(exp.examples);
  const examples = specExamplesToCodeExamples(exp.examples);
  const importStatement = buildImportStatement(exp, spec);

  // Fallback example
  const displayExamples = examples.length > 0 ? examples : [{
    languageId: 'typescript',
    code: `${importStatement}\n\nconst instance = new ${exp.name}(${constructorParams.map(p => p.name).join(', ')});`,
    highlightLang: 'ts',
  }];

  const displayLanguages = languages.length > 0 ? languages : [{ id: 'typescript', label: 'TypeScript' }];

  // Build extends/implements description
  const inheritance = [
    exp.extends && `extends ${exp.extends}`,
    exp.implements?.length && `implements ${exp.implements.join(', ')}`,
  ].filter(Boolean).join(' ');

  return (
    <APISection
      id={exp.id || exp.name}
      title={`class ${exp.name}`}
      description={
        <div className="space-y-3">
          {inheritance && (
            <p className="font-mono text-sm text-muted-foreground">{inheritance}</p>
          )}
          {exp.description && <p>{exp.description}</p>}
          <code className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">
            {importStatement}
          </code>
        </div>
      }
      languages={displayLanguages}
      examples={displayExamples}
      codePanelTitle={`new ${exp.name}()`}
    >
      {/* Constructor */}
      {constructorParams.length > 0 && (
        <ParameterList title="Constructor">
          {constructorParams.map((param, index) => {
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

      {/* Static Members */}
      {(staticProperties.length > 0 || staticMethods.length > 0) && (
        <ParameterList title="Static Members" className="mt-6">
          {staticProperties.map((member) => {
            const badges = getMemberBadges(member);
            return (
              <APIParameterItem
                key={member.name}
                name={member.name}
                type={formatSchema(member.schema)}
                description={
                  badges.length > 0
                    ? `[${badges.join(', ')}] ${member.description || ''}`
                    : member.description
                }
              />
            );
          })}
          {staticMethods.map((member) => {
            const badges = getMemberBadges(member);
            return (
              <APIParameterItem
                key={member.name}
                name={`${member.name}()`}
                type={formatMethodSignature(member)}
                description={
                  badges.length > 0
                    ? `[${badges.join(', ')}] ${member.description || ''}`
                    : member.description
                }
              />
            );
          })}
        </ParameterList>
      )}

      {/* Instance Methods */}
      {instanceMethods.length > 0 && (
        <ParameterList title="Methods" className="mt-6">
          {instanceMethods.map((member) => {
            const badges = getMemberBadges(member);
            return (
              <APIParameterItem
                key={member.name}
                name={`${member.name}()`}
                type={formatMethodSignature(member)}
                description={
                  badges.length > 0
                    ? `[${badges.join(', ')}] ${member.description || ''}`
                    : member.description
                }
              />
            );
          })}
        </ParameterList>
      )}

      {/* Instance Properties */}
      {instanceProperties.length > 0 && (
        <ParameterList title="Properties" className="mt-6">
          {instanceProperties.map((member) => {
            const badges = getMemberBadges(member);
            return (
              <APIParameterItem
                key={member.name}
                name={member.name}
                type={formatSchema(member.schema)}
                description={
                  badges.length > 0
                    ? `[${badges.join(', ')}] ${member.description || ''}`
                    : member.description
                }
              />
            );
          })}
        </ParameterList>
      )}
    </APISection>
  );
}
