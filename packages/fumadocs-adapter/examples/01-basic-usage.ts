/**
 * Example: Fumadocs Adapter Basic Usage
 *
 * Run from fumadocs-adapter: bun examples/01-basic-usage.ts
 */

import {
  buildSignatureString,
  // Core API (re-exported from doc-generator)
  createDocs,
  createOpenPkg, // backward compat alias
  getProperties,
  toFumadocsMetaJSON,
  // Search
  toSearchIndex,
} from '../src/index';

// Sample spec for testing
const sampleSpec = {
  openpkg: '0.4.0',
  meta: {
    ecosystem: 'js/ts',
    name: 'test-package',
    version: '1.0.0',
  },
  exports: [
    {
      id: 'hello',
      name: 'hello',
      kind: 'function',
      description: 'Say hello',
      signatures: [
        {
          parameters: [{ name: 'name', required: true, schema: { type: 'string' } }],
          returns: { schema: { type: 'string' } },
        },
      ],
    },
    {
      id: 'Config',
      name: 'Config',
      kind: 'interface',
      description: 'Configuration interface',
      members: [
        { name: 'debug', kind: 'property', schema: { type: 'boolean' }, optional: true },
        { name: 'timeout', kind: 'property', schema: { type: 'number' } },
      ],
    },
  ],
  types: [],
} as any;

console.log('=== Fumadocs Adapter Usage ===\n');

// Use createDocs (preferred)
const docs = createDocs(sampleSpec);
console.log('Package:', docs.spec.meta.name);
console.log('Exports:', docs.getAllExports().length);

// Or use createOpenPkg (backward compat)
const openpkg = createOpenPkg(sampleSpec);
console.log('\nUsing createOpenPkg (backward compat):');
console.log('Same API:', openpkg.spec.meta.name);

// Query
console.log('\n--- Query ---');
const hello = docs.getExport('hello');
if (hello) {
  console.log('Signature:', buildSignatureString(hello));
}

const config = docs.getExport('Config');
if (config?.members) {
  console.log(
    'Config properties:',
    getProperties(config.members)
      .map((p) => p.name)
      .join(', '),
  );
}

// Render
console.log('\n--- Render ---');
const md = docs.toMarkdown({ export: 'hello' });
console.log('Markdown:\n', md);

// Navigation for Fumadocs
console.log('\n--- Fumadocs Navigation ---');
const meta = toFumadocsMetaJSON(sampleSpec, { basePath: '/api' });
console.log(meta);

// Search index
console.log('\n--- Search Index ---');
const searchIndex = toSearchIndex(sampleSpec);
console.log('Records:', searchIndex.records.length);

console.log('\n=== Done ===');
