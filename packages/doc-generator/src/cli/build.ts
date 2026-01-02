import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { Command } from 'commander';
import { createDocs } from '../core/loader';
import { toPagefindRecords } from '../core/search';
import { toHTML } from '../render/html';

const execAsync = promisify(exec);

export interface BuildOptions {
  out: string;
  title?: string;
  search?: boolean;
  verbose?: boolean;
}

export function registerBuildCommand(program: Command): void {
  program
    .command('build <spec>')
    .description('Build static HTML documentation site')
    .option('-o, --out <dir>', 'Output directory', './api-docs')
    .option('-t, --title <title>', 'Site title override')
    .option('--no-search', 'Disable Pagefind search indexing')
    .option('--verbose', 'Verbose output')
    .action(async (specPath: string, options: BuildOptions) => {
      try {
        const resolvedSpec = path.resolve(specPath);

        if (!fs.existsSync(resolvedSpec)) {
          console.error(`Error: Spec file not found: ${resolvedSpec}`);
          process.exit(1);
        }

        const docs = createDocs(resolvedSpec);
        const outDir = path.resolve(options.out);
        const exports = docs.getAllExports();

        if (options.verbose) {
          console.log(`Spec: ${resolvedSpec}`);
          console.log(`Output: ${outDir}`);
          console.log(`Exports: ${exports.length}`);
        }

        // Create output directory
        fs.mkdirSync(outDir, { recursive: true });

        // Generate index.html (full spec)
        console.log('Generating HTML...');

        const indexHtml = toHTML(docs.spec, {
          title: options.title,
          includeStyles: true,
          fullDocument: true,
        });

        fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml);

        // Generate individual export pages
        const pagesDir = path.join(outDir, 'api');
        fs.mkdirSync(pagesDir, { recursive: true });

        for (const exp of exports) {
          const exportHtml = toHTML(docs.spec, {
            export: exp.name,
            title: options.title ? `${exp.name} | ${options.title}` : undefined,
            includeStyles: true,
            fullDocument: true,
            headContent: `<link rel="canonical" href="./api/${slugify(exp.name)}.html">`,
          });

          const filename = `${slugify(exp.name)}.html`;
          fs.writeFileSync(path.join(pagesDir, filename), exportHtml);

          if (options.verbose) {
            console.log(`  api/${filename}`);
          }
        }

        console.log(`Generated ${exports.length + 1} HTML files`);

        // Run Pagefind for search indexing
        if (options.search !== false) {
          console.log('Building search index...');

          try {
            // Try to run pagefind
            await execAsync(`npx pagefind --site ${outDir} --output-subdir _pagefind`, {
              cwd: process.cwd(),
            });
            console.log('Search index created');
          } catch (_err) {
            // Pagefind not available, generate search.json fallback
            if (options.verbose) {
              console.log('Pagefind not available, generating search.json fallback');
            }

            const records = toPagefindRecords(docs.spec, {
              baseUrl: '/api',
            });

            fs.writeFileSync(path.join(outDir, 'search.json'), JSON.stringify(records, null, 2));
            console.log('Generated search.json fallback');
          }
        }

        console.log(`\nBuild complete: ${outDir}`);
        console.log('\nTo serve locally:');
        console.log(`  npx serve ${outDir}`);
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
