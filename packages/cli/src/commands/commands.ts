import type { Command } from 'commander';

const GROUPS: Record<string, string[]> = {
  Composed: ['scan', 'ci', 'health'],
  Analysis: ['coverage', 'lint', 'examples'],
  Extraction: ['extract', 'list', 'get'],
  Comparison: ['diff', 'breaking', 'semver', 'changelog'],
  Setup: ['init', 'config', 'context'],
  Plumbing: ['validate', 'filter', 'cache', 'report', 'release'],
};

export function registerCommandsCommand(program: Command): void {
  program
    .command('commands')
    .description('List all available commands grouped by category')
    .action(() => {
      const maxGroup = Math.max(...Object.keys(GROUPS).map((g) => g.length));
      for (const [group, cmds] of Object.entries(GROUPS)) {
        const pad = ' '.repeat(maxGroup - group.length);
        process.stdout.write(`  ${group}${pad}   ${cmds.join(', ')}\n`);
      }
    });
}
