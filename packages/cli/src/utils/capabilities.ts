import type { Command, Option } from 'commander';

interface FlagInfo {
  name: string;
  description: string;
  type: 'boolean' | 'string' | 'number';
}

interface CommandInfo {
  name: string;
  description: string;
  flags: FlagInfo[];
  positional?: string;
  examples?: string[];
}

interface EntityInfo {
  name: string;
  description: string;
  operations: Record<string, string>;
}

interface WorkflowInfo {
  steps: string[];
  description: string;
}

export interface Capabilities {
  version: string;
  hint: string;
  humanCommands: string[];
  commands: CommandInfo[];
  globalFlags: FlagInfo[];
  entities: EntityInfo[];
  workflows: Record<string, WorkflowInfo>;
}

function optionType(opt: Option): 'boolean' | 'string' | 'number' {
  if (opt.optional || opt.required) return 'string';
  return 'boolean';
}

function extractFlags(cmd: Command): FlagInfo[] {
  return cmd.options.map((opt) => ({
    name: opt.long?.replace(/^--/, '') ?? opt.short?.replace(/^-/, '') ?? '',
    description: opt.description,
    type: optionType(opt),
  }));
}

const COMMAND_EXAMPLES: Record<string, string[]> = {
  scan: ['drift scan --json', 'drift scan --all --json', 'drift scan --ci --json'],
  lint: ['drift lint --json', 'drift lint --all --json'],
  coverage: ['drift coverage --json', 'drift coverage --min 80 --json'],
  extract: ['drift extract --json'],
  list: ['drift list --json'],
  get: ['drift get createClient --json'],
  diff: ['drift diff --base main --json'],
  breaking: ['drift breaking --base main --json'],
  semver: ['drift semver --base main --json'],
  changelog: ['drift changelog --base main --json'],
  ci: ['drift ci --json', 'drift ci --all --json'],
  release: ['drift release --json'],
  context: ['drift context --json', 'drift context --all --json'],
  examples: ['drift examples --typecheck --json'],
  health: ['drift health --json'],
  config: ['drift config list --json', 'drift config get coverage.min --json'],
  init: ['drift init --json'],
  validate: ['drift validate spec.json --json'],
  filter: ['drift filter spec.json --kind function --json'],
  report: ['drift report --json'],
  cache: ['drift cache status', 'drift cache clear'],
};

export function extractCapabilities(program: Command): Capabilities {
  const commands: CommandInfo[] = [];

  for (const cmd of program.commands) {
    const positionalArgs = cmd.registeredArguments;
    commands.push({
      name: cmd.name(),
      description: cmd.description(),
      flags: extractFlags(cmd),
      ...(positionalArgs.length > 0
        ? { positional: positionalArgs.map((a) => a.name()).join(' ') }
        : {}),
      ...(COMMAND_EXAMPLES[cmd.name()] ? { examples: COMMAND_EXAMPLES[cmd.name()] } : {}),
    });
  }

  return {
    version: program.version() ?? '0.0.0',
    hint: "Run 'drift' for human output. Use these primitives with --json for agent workflows.",
    humanCommands: ['scan', 'ci', 'init'],
    commands,
    globalFlags: extractFlags(program),
    entities: [
      {
        name: 'spec',
        description: 'Extracted TypeScript API spec',
        operations: { read: 'extract', list: 'list', get: 'get' },
      },
      {
        name: 'drift-issue',
        description: 'Documentation drift issue',
        operations: { read: 'lint', list: 'scan' },
      },
      {
        name: 'coverage',
        description: 'Documentation coverage metrics',
        operations: { read: 'coverage' },
      },
      {
        name: 'config',
        description: 'Drift configuration',
        operations: { read: 'config get', list: 'config list', update: 'config set' },
      },
      { name: 'context', description: 'Agent context file', operations: { create: 'context' } },
      {
        name: 'history',
        description: 'Coverage/lint history over time',
        operations: { read: 'ci' },
      },
      {
        name: 'examples',
        description: 'Example validation results',
        operations: { read: 'examples' },
      },
    ],
    workflows: {
      'detect-drift': { steps: ['extract', 'lint'], description: 'Find stale JSDoc and prose drift' },
      'full-scan': { steps: ['scan'], description: 'Coverage + lint + prose in one pass' },
      'detect-and-enrich': { steps: ['scan', 'context'], description: 'Scan and generate agent context' },
      'ci-pipeline': { steps: ['ci'], description: 'Run CI checks on changed packages' },
      'pre-release': { steps: ['scan', 'breaking', 'release'], description: 'Full pre-release quality gate' },
    },
  };
}
