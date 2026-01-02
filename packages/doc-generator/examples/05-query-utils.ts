/**
 * Example: Query Utilities
 *
 * Run: bun examples/05-query-utils.ts
 */

import {
  buildSignatureString,
  createDocs,
  formatParameters,
  formatReturnType,
  formatSchema,
  getMethods,
  getProperties,
  isMethod,
  isProperty,
  sortByName,
} from '../src/index';
import spec from './sample-spec.json';

console.log('=== Query Utilities Example ===\n');

const docs = createDocs(spec as any);

// Format schema
console.log('--- Format Schema ---');
console.log('string:', formatSchema({ type: 'string' }));
console.log('number:', formatSchema({ type: 'number' }));
console.log('array:', formatSchema({ type: 'array', items: { type: 'string' } }));
console.log('union:', formatSchema({ anyOf: [{ type: 'string' }, { type: 'number' }] }));
console.log('ref:', formatSchema({ $ref: '#/types/GreetOptions' }));

// Format function signature
console.log('\n--- Format Signature ---');
const greet = docs.getExport('greet');
if (greet?.signatures?.[0]) {
  const sig = greet.signatures[0];
  console.log('Parameters:', formatParameters(sig));
  console.log('Return type:', formatReturnType(sig));
  console.log('Full signature:', buildSignatureString(greet));
}

// Class member utilities
console.log('\n--- Class Member Utils ---');
const logger = docs.getExport('Logger');
if (logger?.members) {
  const methods = getMethods(logger.members);
  const properties = getProperties(logger.members);

  console.log('Methods:', methods.map((m) => m.name).join(', '));
  console.log('Properties:', properties.map((p) => p.name).join(', '));

  // Check individual members
  for (const member of logger.members) {
    console.log(`  ${member.name}: isMethod=${isMethod(member)}, isProperty=${isProperty(member)}`);
  }
}

// Sort exports
console.log('\n--- Sort by Name ---');
const allExports = docs.getAllExports();
const sorted = sortByName(allExports);
console.log('Sorted:', sorted.map((e) => e.name).join(', '));

console.log('\n=== Done ===');
