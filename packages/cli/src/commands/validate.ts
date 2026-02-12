import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSpec } from '@openpkg-ts/spec';
import type { Command } from 'commander';
import { renderValidate } from '../formatters/validate';
import { formatError, formatOutput } from '../utils/output';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    return (
      JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8')).version ?? '0.0.0'
    );
  } catch {
    return '0.0.0';
  }
}

export function registerValidateCommand(program: Command): void {
  program
    .command('validate <file>')
    .description('Validate an OpenPkg spec JSON file')
    .action(async (file: string) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        const filePath = path.resolve(process.cwd(), file);
        const content = readFileSync(filePath, 'utf-8');
        const spec = JSON.parse(content);

        const result = validateSpec(spec);

        const data = {
          valid: result.ok,
          errors: result.ok
            ? []
            : result.errors.map(
                (e: { instancePath?: string; message?: string }) =>
                  `${e.instancePath || '/'}: ${e.message}`,
              ),
        };

        formatOutput('validate', data, startTime, version, renderValidate);

        if (!result.ok) {
          process.exitCode = 1;
        }
      } catch (err) {
        formatError(
          'validate',
          err instanceof Error ? err.message : String(err),
          startTime,
          version,
        );
      }
    });
}
