import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { clearCache, getCacheStatus } from '../cache/spec-cache';
import { renderCacheStatus, renderCacheClear } from '../formatters/cache';
import { formatOutput } from '../utils/output';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function registerCacheCommand(program: Command): void {
  const cache = program
    .command('cache')
    .description('Manage spec extraction cache');

  cache
    .command('status')
    .description('Show cache size, age, and entry count')
    .action(() => {
      const startTime = Date.now();
      const version = getVersion();
      const status = getCacheStatus();
      const data = {
        dir: status.dir,
        entries: status.entries,
        totalBytes: status.totalBytes,
        totalKB: Math.round(status.totalBytes / 1024),
        oldest: status.oldest ? new Date(status.oldest).toISOString() : null,
        newest: status.newest ? new Date(status.newest).toISOString() : null,
      };
      formatOutput('cache status', data, startTime, version, renderCacheStatus);
    });

  cache
    .command('clear')
    .description('Remove all cached specs')
    .action(() => {
      const startTime = Date.now();
      const version = getVersion();
      const removed = clearCache();
      formatOutput('cache clear', { removed }, startTime, version, renderCacheClear);
    });
}
