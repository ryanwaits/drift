import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { diffSpec, categorizeBreakingChanges, recommendSemverBump } from '@openpkg-ts/spec';
import { renderChangelog } from '../formatters/changelog';
import { formatError, formatOutput } from '../utils/output';
import { shouldRenderHuman } from '../utils/render';
import { resolveSpecs } from '../utils/resolve-specs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function generateMarkdown(
  breaking: { name: string; reason: string; severity: string }[],
  added: string[],
  changed: string[],
  bump: string,
): string {
  const lines: string[] = [];

  lines.push(`## Changes (${bump})`);
  lines.push('');

  if (breaking.length > 0) {
    lines.push('### Breaking Changes');
    lines.push('');
    for (const b of breaking) {
      lines.push(`- **${b.name}**: ${b.reason} (${b.severity})`);
    }
    lines.push('');
  }

  if (added.length > 0) {
    lines.push('### Added');
    lines.push('');
    for (const name of added) {
      lines.push(`- ${name}`);
    }
    lines.push('');
  }

  if (changed.length > 0) {
    lines.push('### Changed');
    lines.push('');
    for (const name of changed) {
      lines.push(`- ${name}`);
    }
    lines.push('');
  }

  if (breaking.length === 0 && added.length === 0 && changed.length === 0) {
    lines.push('No changes detected.');
    lines.push('');
  }

  return lines.join('\n');
}

export function registerChangelogCommand(program: Command): void {
  program
    .command('changelog [old] [new]')
    .description('Generate a changelog from spec diff')
    .option('--format <fmt>', 'Output format: md or json', 'md')
    .option('--base <ref>', 'Git ref for old spec')
    .option('--head <ref>', 'Git ref for new spec (default: working tree)')
    .option('--entry <file>', 'Entry file for git ref extraction')
    .action(async (oldPath: string | undefined, newPath: string | undefined, options: { format: string; base?: string; head?: string; entry?: string }) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        const args = [oldPath, newPath].filter(Boolean) as string[];
        const { oldSpec, newSpec } = await resolveSpecs({ args, base: options.base, head: options.head, entry: options.entry });

        const diff = diffSpec(oldSpec, newSpec);
        const breaking = categorizeBreakingChanges(diff.breaking, oldSpec, newSpec);
        const { bump } = recommendSemverBump(diff);

        if (options.format === 'json') {
          const data = {
            bump,
            breaking: breaking.map((b) => ({ name: b.name, reason: b.reason, severity: b.severity })),
            added: diff.nonBreaking,
            changed: diff.docsOnly,
          };
          formatOutput('changelog', data, startTime, version, renderChangelog);
        } else {
          const md = generateMarkdown(breaking, diff.nonBreaking, diff.docsOnly, bump);
          const data = { markdown: md, bump };
          formatOutput('changelog', data, startTime, version, renderChangelog);
        }

        if (!shouldRenderHuman()) {
          const total = diff.breaking.length + diff.nonBreaking.length + diff.docsOnly.length;
          process.stderr.write(`changelog: ${total} change${total === 1 ? '' : 's'}, ${bump} bump\n`);
        }
      } catch (err) {
        formatError('changelog', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
