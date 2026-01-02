import * as fs from 'node:fs';
import * as path from 'node:path';
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
    .action(async (entry, options) => {
      const entryFile = entry || findEntryPoint(process.cwd());

      if (!entryFile) {
        console.error('No entry point found. Please specify an entry file.');
        process.exit(1);
      }

      console.log(`Extracting from: ${entryFile}`);

      const result = await extract({
        entryFile: path.resolve(entryFile),
        ...(options.maxDepth ? { maxTypeDepth: parseInt(options.maxDepth) } : {}),
        resolveExternalTypes: !options.skipResolve,
        schemaExtraction: options.runtime ? 'hybrid' : 'static',
      });

      // Report diagnostics
      for (const diag of result.diagnostics) {
        const prefix = diag.severity === 'error' ? '✗' : diag.severity === 'warning' ? '⚠' : 'ℹ';
        console.log(`${prefix} ${diag.message}`);
      }

      const normalized = normalize(result.spec);
      const validation = validateSpec(normalized);

      if (!validation.ok) {
        console.error('Validation failed:');
        for (const err of validation.errors) {
          console.error(`  - ${err.instancePath}: ${err.message}`);
        }
        process.exit(1);
      }

      fs.writeFileSync(options.output, JSON.stringify(normalized, null, 2));
      console.log(`Generated ${options.output}`);
      console.log(`  ${normalized.exports.length} exports`);
      console.log(`  ${normalized.types?.length || 0} types`);
    });

  return program;
}

function findEntryPoint(cwd: string): string | null {
  // Try to find entry point from package.json
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      // Check types/typings field
      if (pkg.types) return path.join(cwd, pkg.types);
      if (pkg.typings) return path.join(cwd, pkg.typings);

      // Check exports field
      if (pkg.exports?.['.']?.types) return path.join(cwd, pkg.exports['.'].types);

      // Check main field with .ts extension
      if (pkg.main) {
        const mainTs = pkg.main.replace(/\.js$/, '.ts');
        if (fs.existsSync(path.join(cwd, mainTs))) return path.join(cwd, mainTs);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Fallback to common entry points
  const fallbacks = ['src/index.ts', 'index.ts', 'lib/index.ts'];
  for (const fallback of fallbacks) {
    const fullPath = path.join(cwd, fallback);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  return null;
}
