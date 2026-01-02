/**
 * Example: Navigation Generation
 *
 * Run: bun examples/03-navigation.ts
 */

import { createDocs, toDocusaurusSidebarJS, toFumadocsMetaJSON } from '../src/index';
import spec from './sample-spec.json';

console.log('=== Navigation Generation Example ===\n');

const docs = createDocs(spec as any);

// Generic navigation
console.log('--- Generic Navigation (grouped by kind) ---\n');
const genericNav = docs.toNavigation({ format: 'generic', groupBy: 'kind' });
console.log(JSON.stringify(genericNav, null, 2));

// Fumadocs meta.json format
console.log('\n--- Fumadocs meta.json ---\n');
const fumadocsMeta = toFumadocsMetaJSON(spec as any, { basePath: '/api' });
console.log(fumadocsMeta);

// Docusaurus sidebar.js format
console.log('\n--- Docusaurus sidebars.js ---\n');
const docusaurusSidebar = toDocusaurusSidebarJS(spec as any, { basePath: '/api' });
console.log(docusaurusSidebar);

console.log('\n=== Done ===');
