/**
 * Resolve two specs for comparison commands.
 * Supports: file paths, --base/--head git refs, one-arg mode.
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { extract } from '@openpkg-ts/sdk';
import { normalize } from '@openpkg-ts/spec';
import { loadConfig } from '../config/loader';
import { detectEntry } from './detect-entry';
import { extractSpecFromRef, validateRef } from './git-extract';

export interface ResolvedSpecs {
  oldSpec: ReturnType<typeof JSON.parse>;
  newSpec: ReturnType<typeof JSON.parse>;
}

function loadSpec(filePath: string) {
  return JSON.parse(readFileSync(path.resolve(process.cwd(), filePath), 'utf-8'));
}

/**
 * Resolve specs from various input modes:
 *
 * 1. Two file args: `drift diff old.json new.json`
 * 2. --base flag: `drift diff --base main` (base from git, head from current source)
 * 3. --base + --head: `drift diff --base main --head feature`
 * 4. One file arg: `drift diff saved.json` (old from file, new from current source)
 */
export async function resolveSpecs(opts: {
  args: string[];
  base?: string;
  head?: string;
  entry?: string;
}): Promise<ResolvedSpecs> {
  const { config } = loadConfig();
  const cwd = process.cwd();

  const resolveEntry = () => {
    if (opts.entry) return path.resolve(cwd, opts.entry);
    if (config.entry) return path.resolve(cwd, config.entry);
    return detectEntry();
  };

  // Mode 1: --base (and optional --head)
  if (opts.base) {
    if (!validateRef(opts.base)) {
      throw new Error(`Invalid git ref: ${opts.base}`);
    }

    const entryFile = resolveEntry();
    const relEntry = path.relative(cwd, entryFile);

    const oldSpec = await extractSpecFromRef(opts.base, relEntry, cwd);

    let newSpec;
    if (opts.head) {
      if (!validateRef(opts.head)) {
        throw new Error(`Invalid git ref: ${opts.head}`);
      }
      newSpec = await extractSpecFromRef(opts.head, relEntry, cwd);
    } else {
      // Current working tree
      const result = await extract({ entryFile });
      newSpec = normalize(result.spec);
    }

    return { oldSpec, newSpec };
  }

  // Mode 2: Two file args (classic)
  if (opts.args.length >= 2) {
    return {
      oldSpec: loadSpec(opts.args[0]),
      newSpec: loadSpec(opts.args[1]),
    };
  }

  // Mode 3: One file arg (old from file, new from current source)
  if (opts.args.length === 1) {
    const oldSpec = loadSpec(opts.args[0]);
    const entryFile = resolveEntry();
    const result = await extract({ entryFile });
    const newSpec = normalize(result.spec);
    return { oldSpec, newSpec };
  }

  throw new Error('Provide two spec files, or use --base <ref>');
}
