import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { loadConfig } from '../config/loader';
import { renderReport } from '../formatters/report';
import { readHistory, type HistoryEntry } from '../utils/history';
import { formatError, formatOutput } from '../utils/output';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

interface PackageTrend {
  name: string;
  coverageHistory: number[];
  lintHistory: number[];
  first: number;
  last: number;
  delta: number;
  latestLint: number;
}

function buildTrends(entries: HistoryEntry[]): PackageTrend[] {
  const byPackage = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const list = byPackage.get(e.package) ?? [];
    list.push(e);
    byPackage.set(e.package, list);
  }

  const trends: PackageTrend[] = [];
  for (const [name, pkgEntries] of byPackage) {
    // Sort by date
    pkgEntries.sort((a, b) => a.date.localeCompare(b.date));
    const coverageHistory = pkgEntries.map((e) => e.coverage);
    const lintHistory = pkgEntries.map((e) => e.lint);
    const first = coverageHistory[0];
    const last = coverageHistory[coverageHistory.length - 1];
    trends.push({
      name,
      coverageHistory,
      lintHistory,
      first,
      last,
      delta: last - first,
      latestLint: lintHistory[lintHistory.length - 1],
    });
  }

  return trends.sort((a, b) => a.name.localeCompare(b.name));
}

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Show documentation trends from history')
    .option('--all', 'Show all packages')
    .action(async (options: { all?: boolean }) => {
      const startTime = Date.now();
      const version = getVersion();

      try {
        const { config } = loadConfig();
        const entries = readHistory();

        if (entries.length === 0) {
          formatError('report', 'No history found. Run `drift ci` first to build history.', startTime, version);
          return;
        }

        const trends = buildTrends(entries);
        const min = config.coverage?.min ?? 0;

        // Packages needing attention: below threshold or most lint issues
        const attention = trends
          .filter((t) => t.last < min || t.latestLint > 0)
          .sort((a, b) => a.last - b.last);

        const data = {
          trends,
          attention,
          totalEntries: entries.length,
          min,
        };

        formatOutput('report', data, startTime, version, renderReport);
      } catch (err) {
        formatError('report', err instanceof Error ? err.message : String(err), startTime, version);
      }
    });
}
