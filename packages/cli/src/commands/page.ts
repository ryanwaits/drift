import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { buildExportRegistry, buildPageDocument, type PageDocument } from '@driftdev/sdk';
import type { Command } from 'commander';
import { loadDocsMap, resolveDocsFile } from '../config/docs-map';
import { detectEntry } from '../utils/detect-entry';
import { resolveLang, resolveTruth } from '../utils/load-spec';
import { formatError, formatOutput } from '../utils/output';
import { c, indent } from '../utils/render';
import { getVersion } from '../utils/version';

interface PageOptions {
  lang?: string;
  abi?: string;
  spec?: string;
  map?: string;
}

function renderPage(data: PageDocument): string {
  const lines: string[] = [''];
  const n = data.claims.length;
  const slices = data.slices.length;
  lines.push(
    indent(
      `${c.bold(data.path)}  ${n} claim${n === 1 ? '' : 's'}  ${slices} slice${slices === 1 ? '' : 's'}`,
    ),
  );
  if (data.title) lines.push(indent(c.dim(data.title)));
  lines.push('');
  for (const claim of data.claims) {
    const where = `${claim.locator.start.line}:${claim.locator.start.col}`;
    const flag = claim.rule ? claim.rule.type : claim.candidate ? 'candidate' : claim.kind;
    const target = claim.specRef
      ? claim.specRef.member
        ? `${claim.specRef.export}.${claim.specRef.member}`
        : claim.specRef.export
      : claim.text;
    lines.push(indent(`  ${claim.kind.padEnd(10)} ${where.padEnd(8)} ${flag}  ${target}`));
  }
  lines.push('');
  return lines.join('\n');
}

export function registerPageCommand(program: Command): void {
  program
    .command('page <markdown> [entry]')
    .description('Build a page-level claims document for a markdown file (JSON for hosts)')
    .option(
      '--lang <language>',
      'Source language (inferred from --spec/--abi/.clar; default typescript)',
    )
    .option('--abi <path>', 'ABI JSON file (required for --lang clarity)')
    .option('--spec <path>', 'OpenAPI document: path or URL (implies --lang openapi)')
    .option('--map <file>', 'Docs file override (default: auto-load drift.docs.json)')
    .action(async (markdown: string, entry: string | undefined, options: PageOptions) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        const mdAbs = path.resolve(process.cwd(), markdown);
        if (!existsSync(mdAbs)) {
          formatError('page', `Markdown file not found: ${markdown}`, startTime, version);
          return;
        }
        const content = readFileSync(mdAbs, 'utf-8');
        const file = path.relative(process.cwd(), mdAbs).replace(/\\/g, '/') || markdown;

        const lang = resolveLang({
          entry,
          lang: options.lang,
          spec: options.spec,
          abi: options.abi,
        });
        const entryFile =
          entry ?? (lang === 'typescript' && !options.spec ? detectEntry() : undefined);
        const { apiSpec } = await resolveTruth({
          entry: entryFile,
          lang,
          spec: options.spec,
          abi: options.abi,
        });

        const mapPath = resolveDocsFile(options.map);
        const docsMap = mapPath ? loadDocsMap(mapPath).map : undefined;

        const data = buildPageDocument({
          spec: apiSpec,
          registry: buildExportRegistry(apiSpec),
          file,
          content,
          docsMap,
          packageName: apiSpec.meta.name,
        });

        formatOutput('page', data, startTime, version, renderPage);
      } catch (err) {
        formatError('page', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
