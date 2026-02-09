/**
 * Load drift config from drift.config.json or package.json "drift" key.
 * JSON-only — no code execution.
 * Searches upward from cwd. --config overrides search.
 */

import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { type DriftConfig, mergeDefaults, validateConfig } from './drift-config';
import { getGlobalConfigPath } from './global';

export interface LoadedConfig {
  config: DriftConfig;
  configPath: string | null;
}

let _configOverride: string | undefined;

export function setConfigPath(configPath: string | undefined): void {
  _configOverride = configPath;
}

export function loadConfig(cwd = process.cwd()): LoadedConfig {
  // --config override
  if (_configOverride) {
    const absPath = path.resolve(cwd, _configOverride);
    if (!existsSync(absPath)) {
      throw new Error(`Config file not found: ${absPath}`);
    }
    const raw = JSON.parse(readFileSync(absPath, 'utf-8'));
    const result = validateConfig(raw);
    if (!result.ok) {
      throw new Error(`Invalid config at ${absPath}: ${result.errors.join(', ')}`);
    }
    return { config: result.config, configPath: absPath };
  }

  // Search upward for drift.config.json
  let current = path.resolve(cwd);
  const { root } = path.parse(current);

  while (true) {
    // 1. drift.config.json
    const driftConfigPath = path.join(current, 'drift.config.json');
    if (existsSync(driftConfigPath)) {
      try {
        const raw = JSON.parse(readFileSync(driftConfigPath, 'utf-8'));
        const result = validateConfig(raw);
        if (!result.ok) {
          throw new Error(`Invalid config at ${driftConfigPath}: ${result.errors.join(', ')}`);
        }
        return { config: result.config, configPath: driftConfigPath };
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new Error(`Invalid JSON in ${driftConfigPath}`);
        }
        throw err;
      }
    }

    // 2. package.json "drift" key
    const pkgPath = path.join(current, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.drift && typeof pkg.drift === 'object') {
          const result = validateConfig(pkg.drift);
          if (!result.ok) {
            throw new Error(`Invalid "drift" config in ${pkgPath}: ${result.errors.join(', ')}`);
          }
          return { config: result.config, configPath: pkgPath };
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          // Ignore malformed package.json, keep searching
        } else {
          throw err;
        }
      }
    }

    if (current === root) break;
    current = path.dirname(current);
  }

  // Check global config: ~/.drift/config.json
  const globalPath = getGlobalConfigPath();
  if (existsSync(globalPath)) {
    try {
      const raw = JSON.parse(readFileSync(globalPath, 'utf-8'));
      const result = validateConfig(raw);
      if (result.ok) {
        return { config: result.config, configPath: globalPath };
      }
    } catch {
      // Ignore malformed global config, fall through to defaults
    }
  }

  // No config found — return defaults
  return { config: mergeDefaults({}), configPath: null };
}
