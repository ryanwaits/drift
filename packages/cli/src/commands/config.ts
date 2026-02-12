import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import type { Command } from 'commander';
import { getGlobalConfigPath, getGlobalDir } from '../config/global';
import { loadConfig } from '../config/loader';
import { renderConfigGet, renderConfigList } from '../formatters/config';
import { formatError, formatOutput } from '../utils/output';
import { getVersion } from '../utils/version';

function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const keys = keyPath.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const keys = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

function coerceValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  const num = Number(raw);
  if (!Number.isNaN(num) && raw.trim() !== '') return num;
  if (raw.includes(',')) return raw.split(',').map((s) => s.trim());
  return raw;
}

function flattenConfig(
  obj: Record<string, unknown>,
  prefix = '',
): Array<{ key: string; value: unknown }> {
  const entries: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flattenConfig(value as Record<string, unknown>, fullKey));
    } else {
      entries.push({ key: fullKey, value });
    }
  }
  return entries;
}

export function registerConfigCommand(program: Command): void {
  const cmd = program.command('config').description('Manage drift configuration');

  cmd
    .command('list')
    .alias('show')
    .description('Show all config values')
    .action(() => {
      const startTime = Date.now();
      const version = getVersion();
      try {
        const { config, configPath } = loadConfig();
        const entries = flattenConfig(config as unknown as Record<string, unknown>);
        const data = { entries, configPath };
        formatOutput('config', data, startTime, version, renderConfigList);
      } catch (err) {
        formatError('config', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });

  cmd
    .command('get <key>')
    .description('Get a config value by dot-notation key')
    .action((key: string) => {
      const startTime = Date.now();
      const version = getVersion();
      try {
        const { config } = loadConfig();
        const value = getNestedValue(config as unknown as Record<string, unknown>, key);
        const data = { key, value };
        formatOutput('config', data, startTime, version, renderConfigGet);
      } catch (err) {
        formatError('config', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });

  cmd
    .command('set <key> <value>')
    .description('Set a config value (global by default, --project for local)')
    .option('--project', 'Write to drift.config.json in current directory instead of global config')
    .action((key: string, rawValue: string, opts: { project?: boolean }) => {
      const startTime = Date.now();
      const version = getVersion();
      try {
        const configPath = opts.project
          ? path.resolve(process.cwd(), 'drift.config.json')
          : getGlobalConfigPath();

        // Ensure parent dir exists for global config
        if (!opts.project) {
          const dir = getGlobalDir();
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        }

        let existing: Record<string, unknown> = {};
        if (existsSync(configPath)) {
          existing = JSON.parse(readFileSync(configPath, 'utf-8'));
        }
        const value = coerceValue(rawValue);
        setNestedValue(existing, key, value);
        writeFileSync(configPath, `${JSON.stringify(existing, null, 2)}\n`);
        const data = { key, value, configPath };
        formatOutput(
          'config',
          data,
          startTime,
          version,
          (d) => `  ${key} = ${JSON.stringify(d.value)}\n`,
        );
      } catch (err) {
        formatError('config', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
