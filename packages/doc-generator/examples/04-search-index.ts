/**
 * Example: Search Index Generation
 *
 * Run: bun examples/04-search-index.ts
 */

import { createDocs, toAlgoliaRecords, toPagefindRecords } from '../src/index';
import spec from './sample-spec.json';

console.log('=== Search Index Generation Example ===\n');

const docs = createDocs(spec as any);

// Basic search index
console.log('--- Search Index ---\n');
const searchIndex = docs.toSearchIndex();
console.log('Total records:', searchIndex.records.length);
console.log('Records:');
for (const record of searchIndex.records) {
  console.log(`  - ${record.name} (${record.kind}): ${record.description?.slice(0, 40)}...`);
}

// Pagefind format
console.log('\n--- Pagefind Records ---\n');
const pagefindRecords = toPagefindRecords(spec as any, { baseUrl: '/api' });
console.log(JSON.stringify(pagefindRecords.slice(0, 2), null, 2));

// Algolia format
console.log('\n--- Algolia Records ---\n');
const algoliaRecords = toAlgoliaRecords(spec as any, { baseUrl: '/api' });
console.log(JSON.stringify(algoliaRecords.slice(0, 2), null, 2));

console.log('\n=== Done ===');
