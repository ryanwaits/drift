/**
 * Example: JSON Output
 *
 * Run: bun examples/06-json-output.ts
 */

import { createDocs, toJSON, toJSONString } from '../src/index';
import spec from './sample-spec.json';

console.log('=== JSON Output Example ===\n');

const docs = createDocs(spec as any);

// Full spec as simplified JSON
console.log('--- Simplified Spec JSON ---\n');
const simplifiedSpec = docs.toJSON();
console.log(`${JSON.stringify(simplifiedSpec, null, 2).slice(0, 1500)}...\n`);

// Single export as JSON
console.log('--- Single Export JSON: greet ---\n');
const greetJson = toJSON(spec as any, { export: 'greet' });
console.log(JSON.stringify(greetJson, null, 2));

// As JSON string (formatted)
console.log('\n--- JSON String Output ---\n');
const jsonStr = toJSONString(spec as any, { export: 'Logger', pretty: true });
console.log(jsonStr);

console.log('\n=== Done ===');
