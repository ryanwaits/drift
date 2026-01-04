import type { ReportStats } from './stats';

/**
 * Render a GitHub Actions summary format report.
 *
 * This format is optimized for display in GitHub Actions workflow summaries
 * and pull request comments.
 */
export function renderGithubSummary(
  stats: ReportStats,
  options: {
    coverageScore?: number;
    driftCount?: number;
    qualityIssues?: number;
  } = {},
): string {
  const coverageScore = options.coverageScore ?? stats.coverageScore;
  const driftCount = options.driftCount ?? stats.driftCount;
  const qualityIssues = options.qualityIssues ?? 0;

  let output = '';

  // Health score section (if available)
  if (stats.health) {
    const h = stats.health;
    const status = h.score >= 80 ? '✅' : h.score >= 50 ? '⚠️' : '❌';
    output += `## ${status} Documentation Health: ${h.score}%\n\n`;
    output += `| Metric | Score | Details |\n|--------|-------|---------|\n`;
    output += `| Completeness | ${h.completeness.score}% | ${h.completeness.total - h.completeness.documented} missing docs |\n`;
    output += `| Accuracy | ${h.accuracy.score}% | ${h.accuracy.issues} drift issues |\n`;
    if (h.examples) {
      output += `| Examples | ${h.examples.score}% | ${h.examples.passed}/${h.examples.total} passed |\n`;
    }
    output += '\n';
  } else {
    output += `## Documentation Coverage: ${coverageScore}%\n\n`;
  }

  output += `| Metric | Value |\n|--------|-------|\n`;
  output += `| Coverage Score | ${coverageScore}% |\n`;
  output += `| Total Exports | ${stats.totalExports} |\n`;
  output += `| Drift Issues | ${driftCount} |\n`;
  output += `| Quality Issues | ${qualityIssues} |\n`;

  // Add status badge (fallback when no health)
  if (!stats.health) {
    const status = coverageScore >= 80 ? '✅' : coverageScore >= 50 ? '⚠️' : '❌';
    output += `\n${status} Coverage ${coverageScore >= 80 ? 'passing' : coverageScore >= 50 ? 'needs improvement' : 'failing'}\n`;
  }

  return output;
}
