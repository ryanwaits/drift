import { type BatchResult, DRIFT_CATEGORY_LABELS, type DriftCategory } from '@doccov/sdk';
import type { ReportStats } from './stats';

function bar(pct: number, width = 10): string {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function renderMarkdown(
  stats: ReportStats,
  options: { limit?: number; reportUrl?: string } = {},
): string {
  const limit = options.limit ?? 20;
  const { reportUrl } = options;
  const lines: string[] = [];

  lines.push(`# DocCov Report: ${stats.packageName}@${stats.version}`);
  if (reportUrl) {
    lines.push(`[View full report →](${reportUrl})`);
  }
  lines.push('');

  // Health score (if available)
  if (stats.health) {
    const h = stats.health;
    lines.push(`## Documentation Health: ${h.score}%`);
    lines.push('');
    lines.push('| Metric | Score | Details |');
    lines.push('|--------|-------|---------|');
    lines.push(
      `| Completeness | ${h.completeness.score}% | ${h.completeness.total - h.completeness.documented} missing docs |`,
    );
    lines.push(`| Accuracy | ${h.accuracy.score}% | ${h.accuracy.issues} drift issues |`);
    if (h.examples) {
      lines.push(
        `| Examples | ${h.examples.score}% | ${h.examples.passed}/${h.examples.total} passed |`,
      );
    }
    lines.push('');
  }

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

  // Undocumented exports (score === 0)
  const undocExports = stats.exports.filter((e) => e.score === 0);
  if (undocExports.length > 0) {
    lines.push('');
    lines.push('## Undocumented Exports');
    lines.push('');
    lines.push('| Export | Kind | Missing |');
    lines.push('|--------|------|---------|');
    for (const e of undocExports.slice(0, limit)) {
      lines.push(`| \`${e.name}\` | ${e.kind} | ${e.missing.join(', ') || '-'} |`);
    }
    if (undocExports.length > limit) {
      const moreText = `${undocExports.length - limit} more`;
      if (reportUrl) {
        lines.push(`| [${moreText} →](${reportUrl}#undocumented) | | |`);
      } else {
        lines.push(`| ... | | ${moreText} |`);
      }
    }
  }

  // Partial coverage exports (1-99%)
  const partialExports = stats.exports.filter((e) => e.score > 0 && e.score < 100);
  if (partialExports.length > 0) {
    lines.push('');
    lines.push('## Partial Coverage Exports');
    lines.push('');
    lines.push('| Export | Kind | Score | Missing |');
    lines.push('|--------|------|-------|---------|');
    for (const e of partialExports.slice(0, limit)) {
      lines.push(`| \`${e.name}\` | ${e.kind} | ${e.score}% | ${e.missing.join(', ') || '-'} |`);
    }
    if (partialExports.length > limit) {
      const moreText = `${partialExports.length - limit} more`;
      if (reportUrl) {
        lines.push(`| [${moreText} →](${reportUrl}#partial) | | | |`);
      } else {
        lines.push(`| ... | | | ${moreText} |`);
      }
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
      lines.push('| Export | Issue | Expected | Actual |');
      lines.push('|--------|-------|----------|--------|');
      for (const d of issues.slice(0, Math.min(limit, 10))) {
        const hint = d.suggestion ? ` → ${d.suggestion}` : '';
        lines.push(`| \`${d.exportName}\` | ${d.issue}${hint} | ${d.expected ?? '-'} | ${d.actual ?? '-'} |`);
      }
      if (issues.length > 10) {
        const moreText = `${issues.length - 10} more ${category} issues`;
        if (reportUrl) {
          lines.push(`| [${moreText} →](${reportUrl}#drift-${category}) | | | |`);
        } else {
          lines.push(`| ... | ${moreText} | | |`);
        }
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
      const moreText = `${stats.apiSurface.forgotten.length - limit} more`;
      if (reportUrl) {
        lines.push(`| [${moreText} →](${reportUrl}#api-surface) | | |`);
      } else {
        lines.push(`| ... | | ${moreText} |`);
      }
    }
  }

  // Stale References in Documentation
  if (stats.staleRefs && stats.staleRefs.length > 0) {
    lines.push('');
    lines.push('## Stale References');
    lines.push('');
    lines.push(`**${stats.staleRefs.length} stale reference(s)** found in documentation`);
    lines.push('');
    lines.push('| File | Line | Export |');
    lines.push('|------|------|--------|');
    for (const ref of stats.staleRefs.slice(0, limit)) {
      lines.push(`| ${ref.file} | ${ref.line} | \`${ref.exportName}\` |`);
    }
    if (stats.staleRefs.length > limit) {
      const moreText = `${stats.staleRefs.length - limit} more`;
      if (reportUrl) {
        lines.push(`| [${moreText} →](${reportUrl}#stale-refs) | | |`);
      } else {
        lines.push(`| ... | | ${moreText} |`);
      }
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('*Generated by [DocCov](https://doccov.com)*');

  return lines.join('\n');
}

/**
 * Render batch analysis results as markdown.
 */
export function renderBatchMarkdown(
  batchResult: BatchResult,
  options: { limit?: number } = {},
): string {
  const { packages, aggregate } = batchResult;
  const lines: string[] = [];

  lines.push('# Documentation Coverage Report');
  lines.push('');
  lines.push(`## Summary (${packages.length} packages)`);
  lines.push('');
  lines.push('| Package | Health | Exports | Drift |');
  lines.push('|---------|--------|---------|-------|');

  for (const pkg of packages) {
    lines.push(`| ${pkg.name} | ${pkg.health}% | ${pkg.totalExports} | ${pkg.driftCount} |`);
  }

  lines.push(
    `| **Total** | **${aggregate.health}%** | **${aggregate.totalExports}** | **${aggregate.driftCount}** |`,
  );
  lines.push('');

  // Per-package details
  for (const pkg of packages) {
    lines.push(`## ${pkg.name}`);
    lines.push('');
    lines.push(`**Health: ${pkg.health}%** \`${bar(pkg.health)}\``);
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Exports | ${pkg.totalExports} |`);
    lines.push(`| Documented | ${pkg.documented} |`);
    lines.push(`| Coverage | ${pkg.coverageScore}% |`);
    lines.push(`| Drift | ${pkg.driftCount} |`);
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by [DocCov](https://doccov.com)*');

  return lines.join('\n');
}
