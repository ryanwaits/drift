import * as path from 'node:path';
import { getExport, listExports } from '@openpkg-ts/sdk';
import type { Command } from 'commander';
import { type GetData, renderGet } from '../formatters/get';
import { detectEntry } from '../utils/detect-entry';
import { fuzzyTop } from '../utils/fuzzy';
import { resolveLang, resolveTruth } from '../utils/load-spec';
import { formatError, formatOutput } from '../utils/output';
import { c, indent, shouldRenderHuman } from '../utils/render';
import { getVersion } from '../utils/version';

export function registerGetCommand(program: Command): void {
  program
    .command('get <nameOrEntry> [name]')
    .description('Get detailed spec for a single export')
    .option(
      '--lang <language>',
      'Source language (inferred from --spec/--abi/.clar; default typescript)',
    )
    .option('--abi <path>', 'ABI JSON file (required for --lang clarity)')
    .option('--spec <path>', 'OpenAPI document: path or URL (implies --lang openapi)')
    .action(async (nameOrEntry: string, name?: string, options: GetOptions = {}) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        const lang = resolveLang({
          entry: name ? nameOrEntry : undefined,
          lang: options.lang,
          spec: options.spec,
          abi: options.abi,
        });

        if (lang !== 'typescript') {
          // clarity: `drift get <source.clar> <name> --abi ...`; openapi: `drift get <name> --spec ...`
          const entryArg = name ? nameOrEntry : undefined;
          const exportName = name ?? nameOrEntry;
          const { apiSpec } = await resolveTruth({
            entry: entryArg,
            lang,
            spec: options.spec,
            abi: options.abi,
          });
          const allExports = apiSpec.exports ?? [];
          const exp = allExports.find((e) => e.name === exportName || e.id === exportName);

          if (!exp) {
            const suggestions = fuzzyTop(exportName, allExports);
            renderNotFound(exportName, suggestions, startTime, version);
            return;
          }

          const sig = exp.signatures?.[0];
          const data: GetData = {
            export: {
              name: exp.name,
              kind: exp.kind,
              ...(exp.description ? { description: exp.description } : {}),
              ...(exp.deprecated ? { deprecated: true } : {}),
              ...(sig?.parameters
                ? {
                    parameters: sig.parameters.map((p) => ({
                      name: p.name,
                      type: schemaTypeString(p.schema),
                      required: p.required,
                      ...(p.description ? { description: p.description } : {}),
                      schema: p.schema,
                    })),
                  }
                : {}),
              ...(sig?.returns
                ? {
                    returns: {
                      type: schemaTypeString(sig.returns.schema),
                      ...(sig.returns.description ? { description: sig.returns.description } : {}),
                      schema: sig.returns.schema,
                    },
                  }
                : {}),
              ...(exp.members
                ? {
                    members: exp.members.map((m) => ({
                      name: m.name,
                      ...(m.description ? { description: m.description } : {}),
                    })),
                  }
                : {}),
              ...(exp.schema ? { schema: exp.schema } : {}),
              ...(exp.flags ? { flags: exp.flags } : {}),
            },
          };
          formatOutput('get', data, startTime, version, renderGet);
          return;
        }

        let entryFile: string;
        let exportName: string;

        if (name) {
          entryFile = path.resolve(process.cwd(), nameOrEntry);
          exportName = name;
        } else {
          entryFile = detectEntry();
          exportName = nameOrEntry;
        }

        const result = await getExport({ entryFile, exportName });

        if (!result.export) {
          // Fuzzy suggestions
          const listResult = await listExports({ entryFile });
          const suggestions = fuzzyTop(exportName, listResult.exports);
          renderNotFound(exportName, suggestions, startTime, version);
          return;
        }

        // getExport returns SpecType[]; renderGet inlines referenced types by name
        const types: GetData['types'] = Object.fromEntries(
          (result.types ?? []).map((t) => [
            t.name,
            (t.schema ?? {}) as NonNullable<GetData['types']>[string],
          ]),
        );
        formatOutput(
          'get',
          { export: result.export, types } satisfies GetData,
          startTime,
          version,
          renderGet,
        );
      } catch (err) {
        formatError('get', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}

interface GetOptions {
  lang?: string;
  abi?: string;
  spec?: string;
}

/** Compact human label for an ApiSchema (full schema rides alongside in JSON output). */
function schemaTypeString(schema: unknown, depth = 0): string | undefined {
  if (schema === undefined || schema === null) return undefined;
  if (typeof schema === 'string') return schema;
  if (typeof schema !== 'object' || depth > 3) return undefined;
  const s = schema as Record<string, unknown>;
  if (typeof s.$ref === 'string') return s.$ref.split('/').pop();
  const composite = (s.oneOf ?? s.anyOf) as unknown[] | undefined;
  if (Array.isArray(composite)) {
    const arms = composite
      .map((arm) => schemaTypeString(arm, depth + 1) ?? 'unknown')
      .filter((v, i, a) => a.indexOf(v) === i);
    return arms.join(' | ');
  }
  if (s.type === 'array') {
    const item = schemaTypeString(s.items, depth + 1);
    return item ? `${item}[]` : 'array';
  }
  if (typeof s.title === 'string' && (s.type === 'object' || s.type === undefined)) return s.title;
  if (typeof s.type === 'string') return s.type;
  return undefined;
}

function renderNotFound(
  exportName: string,
  suggestions: string[],
  startTime: number,
  version: string,
): void {
  if (suggestions.length > 0 && shouldRenderHuman()) {
    const lines = [
      '',
      indent(`${c.red('x')} Export "${exportName}" not found.`),
      '',
      indent(c.gray('Similar:')),
    ];
    for (const s of suggestions) {
      lines.push(indent(`  ${s}`));
    }
    lines.push('');
    lines.push(indent(`drift get ${suggestions[0]}`));
    lines.push('');
    process.stdout.write(lines.join('\n'));
    process.exitCode = 1;
  } else if (suggestions.length > 0) {
    formatError(
      'get',
      `Export '${exportName}' not found. Similar: ${suggestions.join(', ')}`,
      startTime,
      version,
    );
  } else {
    formatError('get', `Export '${exportName}' not found`, startTime, version);
  }
}
