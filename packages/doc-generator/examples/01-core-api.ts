/**
 * Example: Core API usage
 *
 * Run: bun examples/01-core-api.ts
 */

import { loadSpec } from '../src/index';
import spec from './sample-spec.json';

console.log('=== Core API Example ===\n');

// Load spec using loadSpec (from object)
const docs = loadSpec(spec as any);

console.log('Package:', docs.spec.meta.name);
console.log('Version:', docs.spec.meta.version);
console.log('Total exports:', docs.getAllExports().length);
console.log('Total types:', docs.getAllTypes().length);

// Query by kind
console.log('\n--- Exports by Kind ---');
const functions = docs.getExportsByKind('function');
const interfaces = docs.getExportsByKind('interface');
const classes = docs.getExportsByKind('class');
const enums = docs.getExportsByKind('enum');
const variables = docs.getExportsByKind('variable');

console.log('Functions:', functions.map((e) => e.name).join(', '));
console.log('Interfaces:', interfaces.map((e) => e.name).join(', '));
console.log('Classes:', classes.map((e) => e.name).join(', '));
console.log('Enums:', enums.map((e) => e.name).join(', '));
console.log('Variables:', variables.map((e) => e.name).join(', '));

// Get specific export
console.log('\n--- Get Export by ID ---');
const greet = docs.getExport('greet');
if (greet) {
  console.log('Name:', greet.name);
  console.log('Kind:', greet.kind);
  console.log('Description:', `${greet.description?.slice(0, 50)}...`);
  console.log('Parameters:', greet.signatures?.[0]?.parameters?.map((p) => p.name).join(', '));
}

// Search
console.log('\n--- Search ---');
const logResults = docs.search('log');
console.log('Search "log":', logResults.map((e) => e.name).join(', '));

const greetResults = docs.search('greet');
console.log('Search "greet":', greetResults.map((e) => e.name).join(', '));

// Get deprecated
console.log('\n--- Deprecated Exports ---');
const deprecated = docs.getDeprecated();
console.log('Deprecated:', deprecated.map((e) => e.name).join(', ') || 'None');

// Get by tag
console.log('\n--- Exports by Tag ---');
const betaExports = docs.getExportsByTag('@beta');
console.log('@beta:', betaExports.map((e) => e.name).join(', ') || 'None');

// Group by kind
console.log('\n--- Group by Kind ---');
const grouped = docs.groupByKind();
for (const [kind, exports] of Object.entries(grouped)) {
  console.log(`${kind}: ${exports.length}`);
}

console.log('\n=== Done ===');
