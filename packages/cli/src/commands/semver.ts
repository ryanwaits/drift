import { diffSpec, recommendSemverBump } from '@openpkg-ts/spec';
import type { Command } from 'commander';
import { renderSemver } from '../formatters/semver';
import { formatError, formatOutput } from '../utils/output';
import { shouldRenderHuman } from '../utils/render';
import { resolveSpecs } from '../utils/resolve-specs';
import { getVersion } from '../utils/version';

export function registerSemverCommand(program: Command): void {
  program
    .command('semver [old] [new]')
    .description('Recommend semver bump based on spec changes')
    .option('--base <ref>', 'Git ref for old spec')
    .option('--head <ref>', 'Git ref for new spec (default: working tree)')
    .option('--entry <file>', 'Entry file for git ref extraction')
    .action(
      async (
        oldPath: string | undefined,
        newPath: string | undefined,
        options: { base?: string; head?: string; entry?: string },
      ) => {
        const startTime = Date.now();
        const version = getVersion();

        try {
          const args = [oldPath, newPath].filter(Boolean) as string[];
          const { oldSpec, newSpec } = await resolveSpecs({ args, ...options });

          const diff = diffSpec(oldSpec, newSpec);
          const recommendation = recommendSemverBump(diff);

          const data = {
            bump: recommendation.bump,
            reason: recommendation.reason,
          };

          formatOutput('semver', data, startTime, version, renderSemver);
          if (!shouldRenderHuman()) {
            process.stderr.write(`${recommendation.bump}: ${recommendation.reason}\n`);
          }
        } catch (err) {
          formatError(
            'semver',
            err instanceof Error ? err.message : String(err),
            startTime,
            version,
          );
        }
      },
    );
}
