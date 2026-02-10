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
}

interface EntityInfo {
  name: string;
  description: string;
  operations: Record<string, string>;
}

export interface Capabilities {
  version: string;
  commands: CommandInfo[];
  globalFlags: FlagInfo[];
  entities: EntityInfo[];
  workflows: Record<string, string[]>;
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
    });
  }

  return {
    version: program.version() ?? '0.0.0',
    commands,
    globalFlags: extractFlags(program),
    entities: [
      { name: 'spec', description: 'Extracted TypeScript API spec', operations: { read: 'extract', list: 'list', get: 'get' } },
      { name: 'drift-issue', description: 'Documentation drift issue', operations: { read: 'lint', list: 'scan' } },
      { name: 'coverage', description: 'Documentation coverage metrics', operations: { read: 'coverage' } },
      { name: 'config', description: 'Drift configuration', operations: { read: 'config get', list: 'config list', update: 'config set' } },
      { name: 'context', description: 'Agent context file', operations: { create: 'context' } },
      { name: 'history', description: 'Coverage/lint history over time', operations: { read: 'ci' } },
      { name: 'examples', description: 'Example validation results', operations: { read: 'examples' } },
    ],
    workflows: {
      'detect-drift': ['extract', 'lint'],
      'full-scan': ['scan'],
      'detect-and-enrich': ['scan', 'context'],
      'ci-pipeline': ['ci'],
      'pre-release': ['scan', 'breaking', 'release'],
    },
  };
}
