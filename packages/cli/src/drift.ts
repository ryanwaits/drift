#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { setNoCache } from './cache/spec-cache';
import { registerBreakingCommand } from './commands/breaking';
import { registerCacheCommand } from './commands/cache';
import { registerChangelogCommand } from './commands/changelog';
import { registerCiCommand } from './commands/ci';
import { registerConfigCommand } from './commands/config';
import { registerContextCommand } from './commands/context';
import { registerCoverageCommand } from './commands/coverage';
import { registerDiffCommand } from './commands/diff';
import { registerExamplesCommand } from './commands/examples';
import { registerExtractCommand } from './commands/extract';
import { registerFilterCommand } from './commands/filter';
import { registerGetCommand } from './commands/get';
import { registerHealthCommand } from './commands/health';
import { registerInitCommand } from './commands/init';
import { registerLintCommand } from './commands/lint';
import { registerListCommand } from './commands/list';
import { registerReleaseCommand } from './commands/release';
import { registerReportCommand } from './commands/report';
import { registerScanCommand } from './commands/scan';
import { registerSemverCommand } from './commands/semver';
import { registerValidateCommand } from './commands/validate';
import { loadConfig, setConfigPath } from './config/loader';
import { extractCapabilities } from './utils/capabilities';
import { setOutputMode } from './utils/render';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('drift')
  .description('drift — documentation quality for TypeScript')
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

// Default (bare `drift`)
registerHealthCommand(program);

// Extraction
registerExtractCommand(program);
registerListCommand(program);
registerGetCommand(program);

// Spec ops
registerValidateCommand(program);
registerFilterCommand(program);

// Analysis
registerCoverageCommand(program);
registerExamplesCommand(program);
registerLintCommand(program);
registerScanCommand(program);

// Comparison
registerDiffCommand(program);
registerBreakingCommand(program);
registerSemverCommand(program);
registerChangelogCommand(program);

// CI + Release
registerCiCommand(program);
registerReleaseCommand(program);
registerReportCommand(program);

// Setup
registerInitCommand(program);
registerConfigCommand(program);

// Context
registerContextCommand(program);

// Cache management
registerCacheCommand(program);

// Hide non-human commands from --help (still functional)
const HUMAN_COMMANDS = new Set(['scan', 'ci', 'init']);
for (const cmd of program.commands) {
  if (!HUMAN_COMMANDS.has(cmd.name())) {
    (cmd as any)._hidden = true;
  }
}

if (process.argv.includes('--tools')) {
  const caps = extractCapabilities(program);
  process.stdout.write(`${JSON.stringify(caps, null, 2)}\n`);
  process.exit(0);
}

// Smart default: bare `drift` runs init if no config, scan otherwise
// Skip if user passed --help/-h/--version/-V (let commander handle those)
const rawArgs = process.argv.slice(2);
const hasHelpOrVersion = rawArgs.some((a) =>
  ['-h', '--help', '-V', '--version', '--tools'].includes(a),
);
const userArgs = rawArgs.filter((a) => !a.startsWith('-'));
if (userArgs.length === 0 && !hasHelpOrVersion) {
  const { configPath } = loadConfig();
  const subcommand = configPath ? 'scan' : 'init';
  process.argv.splice(2, 0, subcommand);
}

program.parseAsync().catch(() => {
  process.exit(1);
});
