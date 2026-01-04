/**
 * Changelog Renderer
 *
 * Generates conventional changelog format from spec diffs.
 */
import type { SpecDiffWithDocs } from '@doccov/sdk';
import type { CategorizedBreaking } from '@openpkg-ts/spec';

export interface ChangelogOptions {
  /** Version number for the changelog entry */
  version?: string;
  /** Date for the changelog entry (ISO string or Date) */
  date?: string | Date;
  /** Compare URL for "Full Changelog" link */
  compareUrl?: string;
}

export interface ChangelogData {
  diff: SpecDiffWithDocs;
  categorizedBreaking?: CategorizedBreaking[];
  version?: string;
}

/**
 * Render a changelog entry from a spec diff.
 *
 * Format follows Keep a Changelog / Conventional Changelog conventions:
 * https://keepachangelog.com/
 *
 * @param data - Changelog data with diff
 * @param options - Rendering options
 * @returns Markdown changelog entry
 *
 * @example
 * ```typescript
 * import { diffSpec } from '@openpkg-ts/spec';
 * import { renderChangelog } from '@doccov/cli';
 *
 * const diff = diffSpec(oldSpec, newSpec);
 * const changelog = renderChangelog({ diff }, { version: '1.2.0' });
 * console.log(changelog);
 * ```
 */
export function renderChangelog(data: ChangelogData, options: ChangelogOptions = {}): string {
  const { diff, categorizedBreaking } = data;
  const lines: string[] = [];

  // Header
  const version = options.version ?? data.version ?? 'Unreleased';
  const date =
    options.date instanceof Date
      ? options.date.toISOString().split('T')[0]
      : (options.date ?? new Date().toISOString().split('T')[0]);

  lines.push(`## [${version}] - ${date}`);
  lines.push('');

  // Breaking Changes section
  if (diff.breaking.length > 0) {
    lines.push('### ⚠️ BREAKING CHANGES');
    lines.push('');

    if (categorizedBreaking && categorizedBreaking.length > 0) {
      // Use categorized breaking changes for better descriptions
      for (const breaking of categorizedBreaking) {
        const severity = breaking.severity === 'high' ? '**' : '';
        lines.push(`- ${severity}${breaking.name}${severity}: ${breaking.reason}`);
      }
    } else {
      // Fall back to just listing IDs
      for (const id of diff.breaking) {
        lines.push(`- \`${id}\` removed or changed`);
      }
    }
    lines.push('');
  }

  // Added section
  if (diff.nonBreaking.length > 0) {
    lines.push('### Added');
    lines.push('');
    for (const id of diff.nonBreaking) {
      lines.push(`- \`${id}\``);
    }
    lines.push('');
  }

  // Documentation Changes section
  if (diff.docsOnly.length > 0) {
    lines.push('### Documentation');
    lines.push('');
    for (const id of diff.docsOnly) {
      lines.push(`- Updated documentation for \`${id}\``);
    }
    lines.push('');
  }

  // Coverage summary
  if (diff.coverageDelta !== 0) {
    lines.push('### Coverage');
    lines.push('');
    const arrow = diff.coverageDelta > 0 ? '↑' : '↓';
    const sign = diff.coverageDelta > 0 ? '+' : '';
    lines.push(
      `- Documentation coverage: ${diff.oldCoverage}% → ${diff.newCoverage}% (${arrow} ${sign}${diff.coverageDelta}%)`,
    );
    lines.push('');
  }

  // Drift summary
  if (diff.driftIntroduced > 0 || diff.driftResolved > 0) {
    if (!lines.some((l) => l.startsWith('### Coverage'))) {
      lines.push('### Coverage');
      lines.push('');
    }
    if (diff.driftResolved > 0) {
      lines.push(`- Fixed ${diff.driftResolved} drift issue${diff.driftResolved === 1 ? '' : 's'}`);
    }
    if (diff.driftIntroduced > 0) {
      lines.push(
        `- ${diff.driftIntroduced} new drift issue${diff.driftIntroduced === 1 ? '' : 's'} detected`,
      );
    }
    lines.push('');
  }

  // Compare URL footer
  if (options.compareUrl) {
    lines.push(`**Full Changelog**: ${options.compareUrl}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render a compact changelog suitable for GitHub releases.
 *
 * @param data - Changelog data with diff
 * @param options - Rendering options
 * @returns Compact markdown changelog
 */
export function renderCompactChangelog(
  data: ChangelogData,
  options: ChangelogOptions = {},
): string {
  const { diff, categorizedBreaking } = data;
  const sections: string[] = [];

  // Breaking changes (most important)
  if (diff.breaking.length > 0) {
    const items =
      categorizedBreaking?.map((b) => `- **${b.name}**: ${b.reason}`) ??
      diff.breaking.map((id) => `- \`${id}\``);
    sections.push(`### ⚠️ Breaking Changes\n\n${items.join('\n')}`);
  }

  // New exports
  if (diff.nonBreaking.length > 0) {
    const items = diff.nonBreaking.slice(0, 10).map((id) => `- \`${id}\``);
    const more =
      diff.nonBreaking.length > 10 ? `\n- _...and ${diff.nonBreaking.length - 10} more_` : '';
    sections.push(`### ✨ New\n\n${items.join('\n')}${more}`);
  }

  // Coverage change (only if significant)
  if (Math.abs(diff.coverageDelta) >= 5) {
    const emoji = diff.coverageDelta > 0 ? '📈' : '📉';
    const sign = diff.coverageDelta > 0 ? '+' : '';
    sections.push(`### ${emoji} Coverage\n\n${sign}${diff.coverageDelta}% (${diff.newCoverage}%)`);
  }

  if (sections.length === 0) {
    return 'No significant changes.';
  }

  let result = sections.join('\n\n');

  if (options.compareUrl) {
    result += `\n\n---\n\n[View full diff](${options.compareUrl})`;
  }

  return result;
}
