#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerHealthCommand } from './commands/health';
import { registerBreakingCommand } from './commands/breaking';
import { registerCacheCommand } from './commands/cache';
import { registerChangelogCommand } from './commands/changelog';
import { registerCiCommand } from './commands/ci';
import { registerCoverageCommand } from './commands/coverage';
import { registerExamplesCommand } from './commands/examples';
import { registerDiffCommand } from './commands/diff';
import { registerExtractCommand } from './commands/extract';
import { registerFilterCommand } from './commands/filter';
import { registerGetCommand } from './commands/get';
import { registerConfigCommand } from './commands/config';
import { registerContextCommand } from './commands/context';
import { registerInitCommand } from './commands/init';
import { registerLintCommand } from './commands/lint';
import { registerScanCommand } from './commands/scan';
import { registerListCommand } from './commands/list';
import { registerReleaseCommand } from './commands/release';
import { registerReportCommand } from './commands/report';
import { registerSemverCommand } from './commands/semver';
import { registerValidateCommand } from './commands/validate';
import { setNoCache } from './cache/spec-cache';
import { loadConfig, setConfigPath } from './config/loader';
import { extractCapabilities } from './utils/capabilities';
import { setOutputMode } from './utils/render';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('drift')
  .description('drift — documentation quality primitives for TypeScript')
  .version(packageJson.version)
  .option('--json', 'Force JSON output (default when piped)')
  .option('--human', 'Force human-readable output (default in terminal)')
  .option('--config <path>', 'Path to drift config file')
  .option('--cwd <dir>', 'Run as if started in <dir>')
  .option('--no-cache', 'Bypass spec cache')
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

if (process.argv.includes('--capabilities')) {
  const caps = extractCapabilities(program);
  process.stdout.write(`${JSON.stringify(caps, null, 2)}\n`);
  process.exit(0);
}

// Smart default: bare `drift` runs init if no config, health otherwise
const userArgs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (userArgs.length === 0) {
  const { configPath } = loadConfig();
  const subcommand = configPath ? 'health' : 'init';
  process.argv.splice(2, 0, subcommand);
}

program.parseAsync().catch(() => {
  process.exit(1);
});
