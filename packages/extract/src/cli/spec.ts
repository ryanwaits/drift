import * as fs from 'node:fs';
import * as path from 'node:path';
import { spinner, summary } from 'cli-utils';
import { normalize, validateSpec } from '@openpkg-ts/spec';
import { Command } from 'commander';
import { extract } from '../builder';

export function createProgram(): Command {
  const program = new Command('tspec')
    .description('Extract TypeScript package API to OpenPkg spec')
    .argument('[entry]', 'Entry point file')
    .option('-o, --output <file>', 'Output file', 'openpkg.json')
    .option('--max-depth <n>', 'Max type depth (default: 4)')
    .option('--skip-resolve', 'Skip external type resolution')
    .option('--runtime', 'Enable Standard Schema runtime extraction')
    .option('--only <exports>', 'Only extract these exports (comma-separated, supports * wildcards)')
    .option('--ignore <exports>', 'Ignore these exports (comma-separated, supports * wildcards)')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (entry, options) => {
      let entryFile: string;
      let fromDts = false;

      if (entry) {
        entryFile = entry;
        fromDts = entry.endsWith('.d.ts');
      } else {
        const found = findEntryPoint(process.cwd());
        if (!found) {
          console.error('No entry point found. Please specify an entry file.');
          process.exit(1);
        }
        entryFile = found.path;
        fromDts = found.fromDts;
      }

      if (fromDts) {
        console.warn('⚠ Using .d.ts file. TSDoc comments may be missing.');
        console.warn('  Consider: tspec src/index.ts\n');
      }

      const spin = spinner('Extracting...');

      const result = await extract({
        entryFile: path.resolve(entryFile),
        ...(options.maxDepth ? { maxTypeDepth: parseInt(options.maxDepth) } : {}),
        resolveExternalTypes: !options.skipResolve,
        schemaExtraction: options.runtime ? 'hybrid' : 'static',
        ...(options.only ? { only: options.only.split(',').map((s: string) => s.trim()) } : {}),
        ...(options.ignore ? { ignore: options.ignore.split(',').map((s: string) => s.trim()) } : {}),
      });

      const normalized = normalize(result.spec);
      const validation = validateSpec(normalized);

      if (!validation.ok) {
        spin.fail('Extraction failed');
        console.error('Validation errors:');
        for (const err of validation.errors) {
          console.error(`  - ${err.instancePath}: ${err.message}`);
        }
        process.exit(1);
      }

      fs.writeFileSync(options.output, JSON.stringify(normalized, null, 2));
      spin.success(`Extracted to ${options.output}`);

      // Report diagnostics (info only with --verbose)
      for (const diag of result.diagnostics) {
        if (diag.severity === 'info' && !options.verbose) continue;
        const prefix = diag.severity === 'error' ? '✗' : diag.severity === 'warning' ? '⚠' : 'ℹ';
        console.log(`${prefix} ${diag.message}`);
      }

      // Render summary
      summary()
        .addKeyValue('Exports', normalized.exports.length)
        .addKeyValue('Types', normalized.types?.length || 0)
        .print();
    });

  return program;
}

interface EntryPointResult {
  path: string;
  fromDts: boolean;
}

function findEntryPoint(cwd: string): EntryPointResult | null {
  // Prefer source files first (convention over configuration)
  // Doc generation needs TSDoc/JSDoc comments which exist in source, not .d.ts
  // Check TS first, then JS
  const sourceEntries = [
    'src/index.ts',
    'index.ts',
    'lib/index.ts',
    'src/index.js',
    'index.js',
    'lib/index.js',
  ];
  for (const entry of sourceEntries) {
    const fullPath = path.join(cwd, entry);
    if (fs.existsSync(fullPath)) return { path: fullPath, fromDts: false };
  }

  // Fallback to package.json fields (may be .d.ts)
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      // Check types/typings field
      if (pkg.types) {
        const p = path.join(cwd, pkg.types);
        return { path: p, fromDts: pkg.types.endsWith('.d.ts') };
      }
      if (pkg.typings) {
        const p = path.join(cwd, pkg.typings);
        return { path: p, fromDts: pkg.typings.endsWith('.d.ts') };
      }

      // Check exports field
      if (pkg.exports?.['.']?.types) {
        const p = path.join(cwd, pkg.exports['.'].types);
        return { path: p, fromDts: pkg.exports['.'].types.endsWith('.d.ts') };
      }

      // Check main field - try .ts version first, then .js directly
      if (pkg.main) {
        const mainTs = pkg.main.replace(/\.js$/, '.ts');
        const tsPath = path.join(cwd, mainTs);
        if (fs.existsSync(tsPath)) return { path: tsPath, fromDts: false };

        // Also check if the .js file itself exists (for pure JS projects)
        const jsPath = path.join(cwd, pkg.main);
        if (pkg.main.endsWith('.js') && fs.existsSync(jsPath)) {
          return { path: jsPath, fromDts: false };
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}
