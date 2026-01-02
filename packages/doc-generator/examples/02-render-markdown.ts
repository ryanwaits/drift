/**
 * Example: Render to Markdown
 *
 * Run: bun examples/02-render-markdown.ts
 */

import { createDocs, exportToMarkdown } from '../src/index';
import spec from './sample-spec.json';

console.log('=== Markdown Rendering Example ===\n');

const docs = createDocs(spec as any);

// Render full spec to markdown
console.log('--- Full Spec Markdown (first 1000 chars) ---\n');
const fullMd = docs.toMarkdown();
console.log(`${fullMd.slice(0, 1000)}...\n`);

// Render single export
console.log('--- Single Export: greet ---\n');
const greetMd = docs.toMarkdown({ export: 'greet' });
console.log(greetMd);

// Render with options
console.log('\n--- Single Export: Logger ---\n');
const loggerMd = docs.toMarkdown({ export: 'Logger' });
console.log(loggerMd);

// Using standalone function
console.log('\n--- Using exportToMarkdown directly ---\n');
const greetExport = docs.getExport('greet');
if (greetExport) {
  const md = exportToMarkdown(greetExport, {
    includeExamples: true,
    includeSource: true,
  });
  console.log(md);
}

console.log('\n=== Done ===');
