import { DRIFT_CATEGORY_LABELS, type DriftCategory } from '@doccov/sdk';
import type { ReportStats } from './stats';

function bar(pct: number, width = 10): string {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function renderMarkdown(stats: ReportStats, options: { limit?: number } = {}): string {
  const limit = options.limit ?? 20;
  const lines: string[] = [];

  lines.push(`# DocCov Report: ${stats.packageName}@${stats.version}`);
  lines.push('');
  lines.push(`**Coverage: ${stats.coverageScore}%** \`${bar(stats.coverageScore)}\``);
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Exports | ${stats.totalExports} |`);
  lines.push(`| Fully documented | ${stats.fullyDocumented} |`);
  lines.push(`| Partially documented | ${stats.partiallyDocumented} |`);
  lines.push(`| Undocumented | ${stats.undocumented} |`);
  lines.push(`| Drift issues | ${stats.driftCount} |`);

  // Signal coverage
  lines.push('');
  lines.push('## Coverage by Signal');
  lines.push('');
  lines.push('| Signal | Coverage |');
  lines.push('|--------|----------|');
  for (const [sig, s] of Object.entries(stats.signalCoverage)) {
    lines.push(`| ${sig} | ${s.pct}% \`${bar(s.pct, 8)}\` |`);
  }

  // By kind
  if (stats.byKind.length > 0) {
    lines.push('');
    lines.push('## Coverage by Kind');
    lines.push('');
    lines.push('| Kind | Count | Avg Score |');
    lines.push('|------|-------|-----------|');
    for (const k of stats.byKind) {
      lines.push(`| ${k.kind} | ${k.count} | ${k.avgScore}% |`);
    }
  }

  // Lowest coverage exports
  const lowExports = stats.exports.filter((e) => e.score < 100).slice(0, limit);
  if (lowExports.length > 0) {
    lines.push('');
    lines.push('## Lowest Coverage Exports');
    lines.push('');
    lines.push('| Export | Kind | Score | Missing |');
    lines.push('|--------|------|-------|---------|');
    for (const e of lowExports) {
      lines.push(`| \`${e.name}\` | ${e.kind} | ${e.score}% | ${e.missing.join(', ') || '-'} |`);
    }
    const totalLow = stats.exports.filter((e) => e.score < 100).length;
    if (totalLow > limit) {
      lines.push(`| ... | | | ${totalLow - limit} more |`);
    }
  }

  // Drift issues grouped by category
  if (stats.driftIssues.length > 0) {
    lines.push('');
    lines.push('## Drift Issues');
    lines.push('');

    // Summary line
    const { driftSummary } = stats;
    const summaryParts: string[] = [];
    if (driftSummary.byCategory.structural > 0) {
      summaryParts.push(`${driftSummary.byCategory.structural} structural`);
    }
    if (driftSummary.byCategory.semantic > 0) {
      summaryParts.push(`${driftSummary.byCategory.semantic} semantic`);
    }
    if (driftSummary.byCategory.example > 0) {
      summaryParts.push(`${driftSummary.byCategory.example} example`);
    }
    const fixableNote = driftSummary.fixable > 0 ? ` (${driftSummary.fixable} auto-fixable)` : '';
    lines.push(`**${driftSummary.total} issues** (${summaryParts.join(', ')})${fixableNote}`);
    lines.push('');

    // Category sections
    const categories: DriftCategory[] = ['structural', 'semantic', 'example'];
    for (const category of categories) {
      const issues = stats.driftByCategory[category];
      if (issues.length === 0) continue;

      lines.push(`### ${DRIFT_CATEGORY_LABELS[category]}`);
      lines.push('');
      lines.push('| Export | Issue |');
      lines.push('|--------|-------|');
      for (const d of issues.slice(0, Math.min(limit, 10))) {
        const hint = d.suggestion ? ` → ${d.suggestion}` : '';
        lines.push(`| \`${d.exportName}\` | ${d.issue}${hint} |`);
      }
      if (issues.length > 10) {
        lines.push(`| ... | ${issues.length - 10} more ${category} issues |`);
      }
      lines.push('');
    }
  }

  // API Surface (Forgotten Exports)
  if (stats.apiSurface && stats.apiSurface.forgotten.length > 0) {
    lines.push('');
    lines.push('## API Surface');
    lines.push('');
    lines.push(
      `**${stats.apiSurface.completeness}% complete** (${stats.apiSurface.forgotten.length} forgotten exports)`,
    );
    lines.push('');
    lines.push('| Type | Defined In | Referenced By |');
    lines.push('|------|------------|---------------|');
    for (const f of stats.apiSurface.forgotten.slice(0, limit)) {
      const definedIn = f.definedIn
        ? `${f.definedIn.file}${f.definedIn.line ? `:${f.definedIn.line}` : ''}`
        : '-';
      const refs = f.referencedBy
        .slice(0, 2)
        .map((r) => `${r.exportName} (${r.location})`)
        .join(', ');
      const moreRefs = f.referencedBy.length > 2 ? ` +${f.referencedBy.length - 2}` : '';
      lines.push(`| \`${f.name}\` | ${definedIn} | ${refs}${moreRefs} |`);
    }
    if (stats.apiSurface.forgotten.length > limit) {
      lines.push(`| ... | | ${stats.apiSurface.forgotten.length - limit} more |`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('*Generated by [DocCov](https://doccov.com)*');

  return lines.join('\n');
}
