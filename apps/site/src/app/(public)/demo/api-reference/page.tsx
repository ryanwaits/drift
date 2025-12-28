'use client';

import {
  APIReferencePage,
  APISection,
  APIParameterItem,
  ParameterList,
  ResponseBlock,
  type Language,
  type CodeExample,
  type APIParameterSchema,
} from '@doccov/ui/docskit';

// Sample OpenPkg spec data (from packages/doc-generator/examples/sample-spec.json)
const spec = {
  meta: {
    name: 'my-library',
    version: '1.0.0',
    description: 'Sample library for testing doc-generator',
  },
  exports: [
    {
      id: 'greet',
      name: 'greet',
      kind: 'function',
      description: 'Greet a user by name.\n\nReturns a friendly greeting message.',
      signatures: [
        {
          parameters: [
            {
              name: 'name',
              required: true,
              schema: { type: 'string' },
              description: 'The name of the person to greet',
            },
            {
              name: 'options',
              required: false,
              schema: {
                type: 'object',
                properties: {
                  formal: { type: 'boolean', description: 'Use formal greeting style' },
                  prefix: { type: 'string', description: 'Custom greeting prefix' },
                },
              },
              description: 'Optional greeting configuration',
            },
          ],
          returns: {
            schema: { type: 'string' },
            description: 'The greeting message',
          },
        },
      ],
      examples: [
        {
          title: 'Basic usage',
          code: `import { greet } from 'my-library';

const message = greet('World');
console.log(message); // "Hello, World!"`,
          language: 'typescript',
        },
        {
          title: 'With options',
          code: `import { greet } from 'my-library';

const message = greet('Alice', { formal: true });
console.log(message); // "Good day, Alice."`,
          language: 'typescript',
        },
      ],
    },
    {
      id: 'Logger',
      name: 'Logger',
      kind: 'class',
      description: 'A simple logging utility class.\n\nProvides methods for logging at different levels.',
      signatures: [
        {
          parameters: [
            {
              name: 'prefix',
              required: false,
              schema: { type: 'string' },
              description: 'Optional prefix for all log messages',
            },
          ],
          returns: {
            schema: { type: 'Logger' },
            description: 'A new Logger instance',
          },
        },
      ],
      examples: [
        {
          title: 'Basic logging',
          code: `import { Logger } from 'my-library';

const log = new Logger('[App]');
log.info('Application started');
log.warn('Something might be wrong');
log.error('Something went wrong', new Error('Oops'));`,
          language: 'typescript',
        },
      ],
      members: [
        {
          name: 'info',
          kind: 'method',
          description: 'Log an info message',
          visibility: 'public',
          signatures: [
            {
              parameters: [{ name: 'message', required: true, schema: { type: 'string' } }],
              returns: { schema: { type: 'void' } },
            },
          ],
        },
        {
          name: 'warn',
          kind: 'method',
          description: 'Log a warning message',
          visibility: 'public',
        },
        {
          name: 'error',
          kind: 'method',
          description: 'Log an error message',
          visibility: 'public',
        },
        {
          name: 'prefix',
          kind: 'property',
          description: 'The log prefix',
          visibility: 'public',
          schema: { type: 'string' },
          readonly: true,
        },
      ],
    },
  ],
};

// Helper to convert spec schema to APIParameterSchema
function toAPISchema(schema: Record<string, unknown> | undefined): APIParameterSchema | undefined {
  if (!schema) return undefined;

  const result: APIParameterSchema = {
    type: schema.type as string,
    typeString: schema.type as string,
    description: schema.description as string | undefined,
  };

  if (schema.type === 'object' && schema.properties) {
    result.properties = {};
    for (const [key, value] of Object.entries(schema.properties as Record<string, Record<string, unknown>>)) {
      result.properties[key] = {
        type: value.type as string,
        typeString: value.type as string,
        description: value.description as string | undefined,
      };
    }
  }

  return result;
}

// Convert spec examples to CodeExample format
function toCodeExamples(examples: Array<{ code: string; language?: string; title?: string }>): CodeExample[] {
  return examples.map((ex) => ({
    languageId: ex.language || 'typescript',
    code: ex.code,
    highlightLang: ex.language === 'typescript' ? 'ts' : ex.language,
  }));
}

// Get languages from examples
function getLanguages(examples: Array<{ language?: string }>): Language[] {
  const seen = new Set<string>();
  const languages: Language[] = [];

  for (const ex of examples) {
    const lang = ex.language || 'typescript';
    if (!seen.has(lang)) {
      seen.add(lang);
      languages.push({
        id: lang,
        label: lang === 'typescript' ? 'TypeScript' : lang,
      });
    }
  }

  return languages;
}

export default function OpenPkgAPIReferenceDemoPage() {
  const greetExport = spec.exports[0];
  const loggerExport = spec.exports[1];
  const greetSig = greetExport.signatures[0];
  const loggerSig = loggerExport.signatures[0];

  return (
    <div className="min-h-screen bg-background py-8">
      <APIReferencePage
        title={spec.meta.name}
        description={
          <div>
            <p>{spec.meta.description}</p>
            <p className="text-sm text-muted-foreground mt-2">Version {spec.meta.version}</p>
          </div>
        }
      >
        {/* greet() function */}
        <APISection
          id="greet"
          title="greet()"
          description={greetExport.description}
          languages={getLanguages(greetExport.examples)}
          examples={toCodeExamples(greetExport.examples)}
          codePanelTitle="greet()"
        >
          <div className="mb-4">
            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
              import {'{ greet }'} from '{spec.meta.name}'
            </code>
          </div>

          <ParameterList title="Parameters">
            {greetSig.parameters.map((param) => (
              <APIParameterItem
                key={param.name}
                name={param.name}
                type={param.schema.type === 'object' ? 'object' : (param.schema.type as string)}
                required={param.required}
                description={param.description}
                children={toAPISchema(param.schema as Record<string, unknown>)}
              />
            ))}
          </ParameterList>

          <ResponseBlock
            description={
              <span>
                <span className="font-mono text-sm font-medium">
                  {greetSig.returns.schema.type as string}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {greetSig.returns.description}
                </span>
              </span>
            }
            className="mt-6"
          />
        </APISection>

        {/* Logger class */}
        <APISection
          id="Logger"
          title="Logger"
          description={loggerExport.description}
          languages={getLanguages(loggerExport.examples)}
          examples={toCodeExamples(loggerExport.examples)}
          codePanelTitle="new Logger()"
        >
          <div className="mb-4">
            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
              import {'{ Logger }'} from '{spec.meta.name}'
            </code>
          </div>

          <ParameterList title="Constructor">
            {loggerSig.parameters.map((param) => (
              <APIParameterItem
                key={param.name}
                name={param.name}
                type={param.schema.type as string}
                required={param.required}
                description={param.description}
              />
            ))}
          </ParameterList>

          <ParameterList title="Properties" className="mt-6">
            {loggerExport.members
              .filter((m) => m.kind === 'property')
              .map((member) => (
                <APIParameterItem
                  key={member.name}
                  name={member.name}
                  type={(member.schema?.type as string) || 'unknown'}
                  description={member.description}
                />
              ))}
          </ParameterList>

          <ParameterList title="Methods" className="mt-6">
            {loggerExport.members
              .filter((m) => m.kind === 'method')
              .map((member) => (
                <APIParameterItem
                  key={member.name}
                  name={`${member.name}()`}
                  type="method"
                  description={member.description}
                />
              ))}
          </ParameterList>
        </APISection>
      </APIReferencePage>
    </div>
  );
}
