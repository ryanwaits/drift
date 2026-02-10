/**
 * Coverage History Tracking
 *
 * Stores timestamped snapshots of coverage data for trend analysis.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OpenPkg } from '@openpkg-ts/spec';
import { getStateDir } from '../utils/project-root';
import { isExportDocumented } from './health';

/** Directory for storing history snapshots (relative to state dir) */
export const HISTORY_DIR = 'history';

/**
 * Get the history directory path (uses project root).
 */
function getHistoryDir(cwd: string): string {
  return path.join(getStateDir(cwd), 'history');
}

/**
 * A historical coverage snapshot.
 */
export interface CoverageSnapshot {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Package name */
  package: string;
  /** Package version (if available) */
  version?: string;
  /** Coverage score (0-100) */
  coverageScore: number;
  /** Total number of exports */
  totalExports: number;
  /** Number of documented exports */
  documentedExports: number;
  /** Number of drift issues */
  driftCount: number;
  /** Git commit hash (if available) */
  commit?: string;
  /** Git branch (if available) */
  branch?: string;
}

/**
 * Coverage trend data.
 */
export interface CoverageTrend {
  /** Current snapshot */
  current: CoverageSnapshot;
  /** Previous snapshots (most recent first) */
  history: CoverageSnapshot[];
  /** Score delta from previous */
  delta?: number;
  /** Sparkline data (last N scores) */
  sparkline: number[];
}

/** Default retention period in days */
const RETENTION_DAYS = 90;

/**
 * Weekly summary of coverage data.
 */
export interface WeeklySummary {
  /** Week start date (ISO string) */
  weekStart: string;
  /** Week end date (ISO string) */
  weekEnd: string;
  /** Average coverage for the week */
  avgCoverage: number;
  /** Coverage at start of week */
  startCoverage: number;
  /** Coverage at end of week */
  endCoverage: number;
  /** Change during the week */
  delta: number;
  /** Number of snapshots in the week */
  snapshotCount: number;
}

/**
 * Extended trend analysis result.
 */
export interface ExtendedTrendAnalysis {
  /** Current trend data */
  trend: CoverageTrend;
  /** Weekly summaries (most recent first) */
  weeklySummaries: WeeklySummary[];
  /** 7-day velocity (average daily change) */
  velocity7d: number;
  /** 30-day velocity */
  velocity30d: number;
  /** 90-day velocity */
  velocity90d: number;
  /** Projected coverage in 30 days (based on velocity) */
  projected30d: number;
  /** Best coverage ever recorded */
  allTimeHigh: number;
  /** Worst coverage ever recorded */
  allTimeLow: number;
  /** Date range of available data */
  dataRange: { start: string; end: string } | null;
}

/**
 * Generate a snapshot filename from a timestamp.
 */
function getSnapshotFilename(timestamp: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = timestamp.getFullYear();
  const month = pad(timestamp.getMonth() + 1);
  const day = pad(timestamp.getDate());
  const hours = pad(timestamp.getHours());
  const minutes = pad(timestamp.getMinutes());
  const seconds = pad(timestamp.getSeconds());
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}.json`;
}

/**
 * Compute a coverage snapshot from an OpenPkg spec.
 */
export function computeSnapshot(
  spec: OpenPkg,
  options?: { commit?: string; branch?: string },
): CoverageSnapshot {
  const exports = spec.exports ?? [];
  const documented = exports.filter(isExportDocumented);
  const driftCount = exports.reduce((sum, e) => {
    // Check for drift in the export's docs metadata
    const docs = (e as { docs?: { drift?: unknown[] } }).docs;
    return sum + (docs?.drift?.length ?? 0);
  }, 0);

  const coverageScore =
    exports.length > 0 ? Math.round((documented.length / exports.length) * 100) : 100;

  return {
    timestamp: new Date().toISOString(),
    package: spec.meta.name,
    version: spec.meta.version,
    coverageScore,
    totalExports: exports.length,
    documentedExports: documented.length,
    driftCount,
    commit: options?.commit,
    branch: options?.branch,
  };
}

/**
 * Save a coverage snapshot to history.
 *
 * Uses ~/.drift/projects/<slug>/ for storage.
 *
 * @param snapshot - The snapshot to save
 * @param cwd - Working directory (will resolve to project root)
 */
export function saveSnapshot(snapshot: CoverageSnapshot, cwd: string): void {
  const historyDir = getHistoryDir(cwd);

  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }

  const filename = getSnapshotFilename(new Date(snapshot.timestamp));
  const filepath = path.join(historyDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
}

/**
 * Load all historical snapshots.
 *
 * Uses ~/.drift/projects/<slug>/ for storage.
 *
 * @param cwd - Working directory (will resolve to project root)
 * @returns Array of snapshots sorted by timestamp (most recent first)
 */
export function loadSnapshots(cwd: string): CoverageSnapshot[] {
  const historyDir = getHistoryDir(cwd);

  if (!fs.existsSync(historyDir)) {
    return [];
  }

  const files = fs
    .readdirSync(historyDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse(); // Most recent first

  const snapshots: CoverageSnapshot[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(historyDir, file), 'utf-8');
      snapshots.push(JSON.parse(content) as CoverageSnapshot);
    } catch {
      // Skip invalid files
    }
  }

  return snapshots;
}

/**
 * Get coverage trend data.
 *
 * @param spec - Current OpenPkg spec
 * @param cwd - Working directory
 * @param options - Optional git metadata
 * @returns Trend data with history and delta
 */
export function getTrend(
  spec: OpenPkg,
  cwd: string,
  options?: { commit?: string; branch?: string },
): CoverageTrend {
  const current = computeSnapshot(spec, options);
  const history = loadSnapshots(cwd);

  // Calculate delta from previous
  const delta = history.length > 0 ? current.coverageScore - history[0].coverageScore : undefined;

  // Generate sparkline data (last 10 points + current)
  const sparklineHistory = history.slice(0, 9).map((s) => s.coverageScore);
  const sparkline = [current.coverageScore, ...sparklineHistory].reverse();

  return {
    current,
    history,
    delta,
    sparkline,
  };
}

/**
 * Generate a sparkline character representation.
 *
 * @param values - Array of values (0-100 for coverage)
 * @returns Sparkline string using unicode characters
 */
export function renderSparkline(values: number[]): string {
  if (values.length === 0) return '';

  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((v) => {
      const normalized = (v - min) / range;
      const index = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
      return chars[index];
    })
    .join('');
}

/**
 * Format a delta value with arrow and color indicator.
 *
 * @param delta - Coverage delta (positive = improvement)
 * @returns Formatted delta string
 */
export function formatDelta(delta: number): string {
  if (delta > 0) return `↑${delta}%`;
  if (delta < 0) return `↓${Math.abs(delta)}%`;
  return '→0%';
}

/**
 * Prune old snapshots to keep history manageable.
 *
 * Uses ~/.drift/projects/<slug>/ for storage.
 *
 * @param cwd - Working directory (will resolve to project root)
 * @param keepCount - Number of snapshots to keep (default: 100)
 * @returns Number of snapshots deleted
 */
export function pruneHistory(cwd: string, keepCount = 100): number {
  const historyDir = getHistoryDir(cwd);

  if (!fs.existsSync(historyDir)) {
    return 0;
  }

  const files = fs
    .readdirSync(historyDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse(); // Most recent first

  const toDelete = files.slice(keepCount);

  for (const file of toDelete) {
    try {
      fs.unlinkSync(path.join(historyDir, file));
    } catch {
      // Ignore deletion errors
    }
  }

  return toDelete.length;
}

/**
 * Load snapshots within a date range.
 *
 * @param cwd - Working directory
 * @param days - Number of days to include
 * @returns Filtered snapshots
 */
export function loadSnapshotsForDays(cwd: string, days: number): CoverageSnapshot[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const allSnapshots = loadSnapshots(cwd);
  return allSnapshots.filter((s) => new Date(s.timestamp) >= cutoffDate);
}

/**
 * Calculate velocity (average daily coverage change).
 *
 * @param snapshots - Snapshots to analyze (most recent first)
 * @returns Average daily change in coverage percentage
 */
function calculateVelocity(snapshots: CoverageSnapshot[]): number {
  if (snapshots.length < 2) return 0;

  const newest = snapshots[0];
  const oldest = snapshots[snapshots.length - 1];

  const newestDate = new Date(newest.timestamp);
  const oldestDate = new Date(oldest.timestamp);
  const daysDiff = (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff < 1) return 0;

  const coverageDiff = newest.coverageScore - oldest.coverageScore;
  return Math.round((coverageDiff / daysDiff) * 100) / 100;
}

/**
 * Get the start of week (Sunday) for a given date.
 */
function getWeekStart(date: Date): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Generate weekly summaries from snapshots.
 *
 * @param snapshots - Snapshots to summarize (most recent first)
 * @returns Weekly summaries (most recent first)
 */
export function generateWeeklySummaries(snapshots: CoverageSnapshot[]): WeeklySummary[] {
  if (snapshots.length === 0) return [];

  // Group snapshots by week
  const weeklyGroups = new Map<string, CoverageSnapshot[]>();

  for (const snapshot of snapshots) {
    const weekStart = getWeekStart(new Date(snapshot.timestamp));
    const weekKey = weekStart.toISOString().split('T')[0];

    const group = weeklyGroups.get(weekKey) ?? [];
    group.push(snapshot);
    weeklyGroups.set(weekKey, group);
  }

  // Generate summaries
  const summaries: WeeklySummary[] = [];

  for (const [weekKey, weekSnapshots] of weeklyGroups) {
    // Sort by timestamp (oldest first for this calculation)
    const sorted = [...weekSnapshots].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const weekStart = new Date(weekKey);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const scores = sorted.map((s) => s.coverageScore);
    const avgCoverage = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const startCoverage = sorted[0].coverageScore;
    const endCoverage = sorted[sorted.length - 1].coverageScore;

    summaries.push({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      avgCoverage,
      startCoverage,
      endCoverage,
      delta: endCoverage - startCoverage,
      snapshotCount: sorted.length,
    });
  }

  // Sort by week (most recent first)
  return summaries.sort(
    (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime(),
  );
}

/**
 * Get extended trend analysis with velocity and projections.
 *
 * @param spec - Current OpenPkg spec
 * @param cwd - Working directory
 * @param options - Optional git metadata
 * @returns Extended trend analysis
 */
export function getExtendedTrend(
  spec: OpenPkg,
  cwd: string,
  options?: {
    commit?: string;
    branch?: string;
  },
): ExtendedTrendAnalysis {
  // Get base trend
  const trend = getTrend(spec, cwd, options);

  // Load snapshots for the retention period (90 days)
  const periodSnapshots = loadSnapshotsForDays(cwd, RETENTION_DAYS);

  // Calculate velocities
  const snapshots7d = loadSnapshotsForDays(cwd, 7);
  const snapshots30d = loadSnapshotsForDays(cwd, 30);
  const snapshots90d = loadSnapshotsForDays(cwd, 90);

  const velocity7d = calculateVelocity(snapshots7d);
  const velocity30d = calculateVelocity(snapshots30d);
  const velocity90d = calculateVelocity(snapshots90d);

  // Calculate projected coverage
  const currentScore = trend.current.coverageScore;
  const projected30d = Math.min(100, Math.max(0, Math.round(currentScore + velocity30d * 30)));

  // Calculate all-time high/low
  const allScores = [trend.current.coverageScore, ...trend.history.map((s) => s.coverageScore)];
  const allTimeHigh = Math.max(...allScores);
  const allTimeLow = Math.min(...allScores);

  // Get data range
  const dataRange =
    trend.history.length > 0
      ? {
          start: trend.history[trend.history.length - 1].timestamp,
          end: trend.current.timestamp,
        }
      : null;

  // Generate weekly summaries
  const allSnapshots = [trend.current, ...periodSnapshots];
  const weeklySummaries = generateWeeklySummaries(allSnapshots);

  return {
    trend,
    weeklySummaries,
    velocity7d,
    velocity30d,
    velocity90d,
    projected30d,
    allTimeHigh,
    allTimeLow,
    dataRange,
  };
}
