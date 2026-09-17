#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { setNoCache } from './cache/spec-cache';
import { registerDocsCommand } from './commands/docs';
import { registerExtractCommand } from './commands/extract';
import { registerGetCommand } from './commands/get';
import { registerListCommand } from './commands/list';
import { registerMcpCommand } from './commands/mcp';
import { registerScanCommand } from './commands/scan';
import { setConfigPath } from './config/loader';
import { extractCapabilities } from './utils/capabilities';
import { setOutputMode } from './utils/render';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('drift')
  .description('drift — detect when your docs drift from your code')
  .version(packageJson.version)
  .option('--json', 'Force JSON output (default when piped)')
  .option('--human', 'Force human-readable output (default in terminal)')
  .option('--config <path>', 'Path to drift config file')
  .option('--cwd <dir>', 'Run as if started in <dir>')
  .option('--no-cache', 'Bypass spec cache')
  .option('--tools', 'List all available tools for agent use (JSON)')
  .hook('preAction', (_thisCommand) => {
    const opts = program.opts();
    if (opts.cwd) {
      process.chdir(path.resolve(opts.cwd));
    }
    setOutputMode({ json: opts.json, human: opts.human });
    setConfigPath(opts.config);
    if (opts.cache === false) setNoCache(true);
  });

registerScanCommand(program);
registerListCommand(program);
registerGetCommand(program);
registerDocsCommand(program);
registerMcpCommand(program);
registerExtractCommand(program);

for (const cmd of program.commands) {
  if (cmd.name() === 'extract') {
    (cmd as unknown as { _hidden?: boolean })._hidden = true;
  }
}

program.addHelpText(
  'after',
  '\nAgent mode:\n  drift --tools    JSON manifest of all commands for agent use\n',
);

if (process.argv.includes('--tools')) {
  const caps = extractCapabilities(program);
  process.stdout.write(`${JSON.stringify(caps, null, 2)}\n`);
  process.exit(0);
}

// Bare `drift` always runs scan
const rawArgs = process.argv.slice(2);
const hasHelpOrVersion = rawArgs.some((a) =>
  ['-h', '--help', '-V', '--version', '--tools'].includes(a),
);
const userArgs = rawArgs.filter((a) => !a.startsWith('-'));
if (userArgs.length === 0 && !hasHelpOrVersion) {
  process.argv.splice(2, 0, 'scan');
}

program.parseAsync().catch(() => {
  process.exit(2);
});
