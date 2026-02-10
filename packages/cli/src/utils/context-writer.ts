import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { getProjectDir } from '../config/global';
import type { DriftConfig } from '../config/drift-config';
import type { HistoryEntry } from './history';

export interface PackageContext {
  name: string;
  coverage: number;
  lintIssues: number;
  exports: number;
  documented?: number;
  undocumented?: string[];
}

export interface ContextData {
  packages: PackageContext[];
  history: HistoryEntry[];
  config: DriftConfig;
  commit: string | null;
}

export function renderContextMarkdown(data: ContextData): string {
  const lines: string[] = [];

  // Project
  lines.push('## Project');
  lines.push('');
  lines.push(`- **Packages**: ${data.packages.length}`);
  if (data.commit) lines.push(`- **Commit**: ${data.commit}`);
  lines.push('');

  // Current State
  lines.push('## Current State');
  lines.push('');
  if (data.packages.length > 0) {
    lines.push('| Package | Exports | Coverage | Lint Issues |');
    lines.push('|---------|---------|----------|-------------|');
    for (const pkg of data.packages) {
      lines.push(`| ${pkg.name} | ${pkg.exports} | ${pkg.coverage}% | ${pkg.lintIssues} |`);
    }
    lines.push('');

    const avgCoverage = Math.round(
      data.packages.reduce((s, p) => s + p.coverage, 0) / data.packages.length,
    );
    const totalIssues = data.packages.reduce((s, p) => s + p.lintIssues, 0);
    lines.push(`**Average coverage**: ${avgCoverage}%  `);
    lines.push(`**Total lint issues**: ${totalIssues}`);
    lines.push('');
  }

  // Recent Activity
  if (data.history.length > 0) {
    lines.push('## Recent Activity');
    lines.push('');
    const sorted = [...data.history].sort((a, b) => b.date.localeCompare(a.date));
    const lastScan = sorted[0].date;
    lines.push(`- **Last scan**: ${lastScan}`);

    // Weekly trend: compare latest vs 7 days ago
    const latestDate = sorted[0].date;
    const weekAgo = new Date(new Date(latestDate).getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const recentEntries = sorted.filter((e) => e.date >= weekAgo);
    if (recentEntries.length > 1) {
      const latestAvg = avgCoverageForDate(sorted, latestDate);
      const oldestInWeek = recentEntries[recentEntries.length - 1];
      const oldAvg = avgCoverageForDate(sorted, oldestInWeek.date);
      const delta = latestAvg - oldAvg;
      const sign = delta >= 0 ? '+' : '';
      lines.push(`- **7-day trend**: ${sign}${delta}% coverage`);
    }
    lines.push('');
  }

  // Attention Required
  const minCov = data.config.coverage?.min;
  const belowThreshold = minCov ? data.packages.filter((p) => p.coverage < minCov) : [];
  const withIssues = data.packages.filter((p) => p.lintIssues > 0);
  if (belowThreshold.length > 0 || withIssues.length > 0) {
    lines.push('## Attention Required');
    lines.push('');
    for (const pkg of belowThreshold) {
      lines.push(`- **${pkg.name}**: coverage ${pkg.coverage}% (min ${minCov}%)`);
    }
    for (const pkg of withIssues) {
      lines.push(`- **${pkg.name}**: ${pkg.lintIssues} lint issue${pkg.lintIssues === 1 ? '' : 's'}`);
    }
    // Top offenders by issue count
    const sorted = [...withIssues].sort((a, b) => b.lintIssues - a.lintIssues);
    if (sorted.length > 3) {
      lines.push('');
      lines.push('Top offenders:');
      for (const pkg of sorted.slice(0, 3)) {
        lines.push(`  1. ${pkg.name} (${pkg.lintIssues} issues)`);
      }
    }
    lines.push('');
  }

  // Project Rules
  lines.push('## Project Rules');
  lines.push('');
  if (data.config.coverage?.min) lines.push(`- **Min coverage**: ${data.config.coverage.min}%`);
  lines.push(`- **Lint**: ${data.config.lint !== false ? 'enabled' : 'disabled'}`);
  if (data.config.coverage?.ratchet) lines.push('- **Ratchet**: enabled');
  if (data.config.docs?.include) lines.push(`- **Docs include**: ${data.config.docs.include.join(', ')}`);
  if (data.config.docs?.exclude) lines.push(`- **Docs exclude**: ${data.config.docs.exclude.join(', ')}`);
  lines.push('');

  return lines.join('\n');
}

function avgCoverageForDate(entries: HistoryEntry[], date: string): number {
  const forDate = entries.filter((e) => e.date === date);
  if (forDate.length === 0) return 0;
  return Math.round(forDate.reduce((s, e) => s + e.coverage, 0) / forDate.length);
}

export function writeContext(cwd: string, data: ContextData): void {
  const dir = getProjectDir(cwd);
  mkdirSync(dir, { recursive: true });
  const content = renderContextMarkdown(data);
  writeFileSync(path.join(dir, 'context.md'), content);
}
