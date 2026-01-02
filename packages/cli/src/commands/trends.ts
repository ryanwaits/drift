/**
 * Coverage Trends Command
 *
 * Display historical coverage data and trends.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spinner } from 'cli-utils';
import {
  type CoverageSnapshot,
  type CoverageTrend,
  formatDelta,
  getExtendedTrend,
  getTrend,
  loadSnapshots,
  pruneByTier,
  pruneHistory,
  RETENTION_DAYS,
  type RetentionTier,
  renderSparkline,
  saveSnapshot,
} from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';

export interface TrendsOptions {
  cwd: string;
  limit?: string;
  prune?: string;
  record?: boolean;
  json?: boolean;
  extended?: boolean;
  tier?: string;
  weekly?: boolean;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getColorForScore(score: number): (text: string) => string {
  if (score >= 90) return chalk.green;
  if (score >= 70) return chalk.yellow;
  if (score >= 50) return chalk.hex('#FFA500'); // orange
  return chalk.red;
}

function formatSnapshot(snapshot: CoverageSnapshot): string {
  const color = getColorForScore(snapshot.coverageScore);
  const date = formatDate(snapshot.timestamp);
  const version = snapshot.version ? ` v${snapshot.version}` : '';
  const commit = snapshot.commit ? chalk.gray(` (${snapshot.commit.slice(0, 7)})`) : '';

  return `${chalk.gray(date)}  ${color(`${snapshot.coverageScore}%`)}  ${snapshot.documentedExports}/${snapshot.totalExports} exports${version}${commit}`;
}

function formatWeekDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatVelocity(velocity: number): string {
  if (velocity > 0) return chalk.green(`+${velocity}%/day`);
  if (velocity < 0) return chalk.red(`${velocity}%/day`);
  return chalk.gray('0%/day');
}

export function registerTrendsCommand(program: Command): void {
  program
    .command('trends')
    .description('Show coverage trends over time')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('-n, --limit <count>', 'Number of snapshots to show', '10')
    .option('--prune <count>', 'Prune history to keep only N snapshots')
    .option('--record', 'Record current coverage to history')
    .option('--json', 'Output as JSON')
    .option('--extended', 'Show extended trend analysis (velocity, projections)')
    .option('--tier <tier>', 'Retention tier: free (7d), team (30d), pro (90d)', 'pro')
    .option('--weekly', 'Show weekly summary breakdown')
    .action(async (options: TrendsOptions) => {
      const cwd = path.resolve(options.cwd);
      const tier = (options.tier ?? 'pro') as RetentionTier;

      // Handle prune operation
      if (options.prune) {
        // If prune is a number, use count-based pruning
        const keepCount = parseInt(options.prune, 10);
        if (!Number.isNaN(keepCount)) {
          const deleted = pruneHistory(cwd, keepCount);
          console.log(
            chalk.green(`Pruned ${deleted} old snapshots, kept ${keepCount} most recent`),
          );
        } else {
          // Otherwise prune by tier
          const deleted = pruneByTier(cwd, tier);
          console.log(
            chalk.green(`Pruned ${deleted} snapshots older than ${RETENTION_DAYS[tier]} days`),
          );
        }
        return;
      }

      // Load current spec if recording
      if (options.record) {
        const specPath = path.resolve(cwd, 'openpkg.json');
        if (!fs.existsSync(specPath)) {
          console.error(
            chalk.red('No openpkg.json found. Run `doccov spec` first to generate a spec.'),
          );
          process.exit(1);
        }

        const spin = spinner('Recording coverage snapshot');
        try {
          const specContent = fs.readFileSync(specPath, 'utf-8');
          const spec = JSON.parse(specContent) as OpenPkg;

          const trend = getTrend(spec, cwd);
          saveSnapshot(trend.current, cwd);

          spin.success('Recorded coverage snapshot');
          console.log(formatSnapshot(trend.current));

          if (trend.delta !== undefined) {
            const deltaStr = formatDelta(trend.delta);
            const deltaColor =
              trend.delta > 0 ? chalk.green : trend.delta < 0 ? chalk.red : chalk.gray;
            console.log(chalk.gray('Change from previous:'), deltaColor(deltaStr));
          }
          return;
        } catch (error) {
          spin.fail('Failed to record snapshot');
          console.error(
            chalk.red('Failed to read openpkg.json:'),
            error instanceof Error ? error.message : error,
          );
          process.exit(1);
        }
      }

      // Load and display history
      const snapshots = loadSnapshots(cwd);
      const limit = parseInt(options.limit ?? '10', 10);

      if (snapshots.length === 0) {
        console.log(chalk.yellow('No coverage history found.'));
        console.log(chalk.gray('Run `doccov trends --record` to save the current coverage.'));
        return;
      }

      if (options.json) {
        const output: CoverageTrend = {
          current: snapshots[0],
          history: snapshots.slice(1),
          delta:
            snapshots.length > 1
              ? snapshots[0].coverageScore - snapshots[1].coverageScore
              : undefined,
          sparkline: snapshots
            .slice(0, 10)
            .map((s) => s.coverageScore)
            .reverse(),
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Display trend header
      const sparklineData = snapshots
        .slice(0, 10)
        .map((s) => s.coverageScore)
        .reverse();
      const sparkline = renderSparkline(sparklineData);

      console.log(chalk.bold('Coverage Trends'));
      console.log(chalk.gray(`Package: ${snapshots[0].package}`));
      console.log(chalk.gray(`Sparkline: ${sparkline}`));
      console.log('');

      // Calculate overall trend
      if (snapshots.length >= 2) {
        const oldest = snapshots[snapshots.length - 1];
        const newest = snapshots[0];
        const overallDelta = newest.coverageScore - oldest.coverageScore;
        const deltaStr = formatDelta(overallDelta);
        const deltaColor =
          overallDelta > 0 ? chalk.green : overallDelta < 0 ? chalk.red : chalk.gray;
        console.log(
          chalk.gray('Overall trend:'),
          deltaColor(deltaStr),
          chalk.gray(`(${snapshots.length} snapshots)`),
        );
        console.log('');
      }

      // Show extended analysis if requested
      if (options.extended) {
        const specPath = path.resolve(cwd, 'openpkg.json');
        if (fs.existsSync(specPath)) {
          try {
            const specContent = fs.readFileSync(specPath, 'utf-8');
            const spec = JSON.parse(specContent) as OpenPkg;
            const extended = getExtendedTrend(spec, cwd, { tier });

            console.log(chalk.bold('Extended Analysis'));
            console.log(chalk.gray(`Tier: ${tier} (${RETENTION_DAYS[tier]}-day retention)`));
            console.log('');

            // Velocity metrics
            console.log('  Velocity:');
            console.log(`    7-day:   ${formatVelocity(extended.velocity7d)}`);
            console.log(`    30-day:  ${formatVelocity(extended.velocity30d)}`);
            if (extended.velocity90d !== undefined) {
              console.log(`    90-day:  ${formatVelocity(extended.velocity90d)}`);
            }
            console.log('');

            // Projections
            const projColor =
              extended.projected30d >= extended.trend.current.coverageScore
                ? chalk.green
                : chalk.red;
            console.log(`  Projected (30d): ${projColor(`${extended.projected30d}%`)}`);
            console.log(`  All-time high:   ${chalk.green(`${extended.allTimeHigh}%`)}`);
            console.log(`  All-time low:    ${chalk.red(`${extended.allTimeLow}%`)}`);

            if (extended.dataRange) {
              const startDate = formatWeekDate(extended.dataRange.start);
              const endDate = formatWeekDate(extended.dataRange.end);
              console.log(chalk.gray(`  Data range: ${startDate} - ${endDate}`));
            }
            console.log('');

            // Show weekly summaries if requested
            if (options.weekly && extended.weeklySummaries.length > 0) {
              console.log(chalk.bold('Weekly Summary'));
              const weekLimit = Math.min(extended.weeklySummaries.length, 8);

              for (let i = 0; i < weekLimit; i++) {
                const week = extended.weeklySummaries[i];
                const weekStart = formatWeekDate(week.weekStart);
                const weekEnd = formatWeekDate(week.weekEnd);
                const deltaColor =
                  week.delta > 0 ? chalk.green : week.delta < 0 ? chalk.red : chalk.gray;
                const deltaStr = week.delta > 0 ? `+${week.delta}%` : `${week.delta}%`;

                console.log(
                  `  ${weekStart} - ${weekEnd}:  ${week.avgCoverage}% avg  ${deltaColor(deltaStr)}  (${week.snapshotCount} snapshots)`,
                );
              }

              if (extended.weeklySummaries.length > weekLimit) {
                console.log(
                  chalk.gray(`  ... and ${extended.weeklySummaries.length - weekLimit} more weeks`),
                );
              }
              console.log('');
            }
          } catch {
            console.log(chalk.yellow('Could not load openpkg.json for extended analysis'));
            console.log('');
          }
        }
      }

      // Display history
      console.log(chalk.bold('History'));
      const displaySnapshots = snapshots.slice(0, limit);

      for (let i = 0; i < displaySnapshots.length; i++) {
        const snapshot = displaySnapshots[i];
        const prefix = i === 0 ? chalk.cyan('→') : ' ';
        console.log(`${prefix} ${formatSnapshot(snapshot)}`);
      }

      if (snapshots.length > limit) {
        console.log(chalk.gray(`  ... and ${snapshots.length - limit} more`));
      }
    });
}
