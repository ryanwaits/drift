/**
 * PR comment renderer for GitHub Actions
 *
 * Generates actionable markdown optimized for PR comments
 */

import { getExportDrift, type SpecDiffWithDocs } from '@doccov/sdk';
import type { DocCovSpec } from '@doccov/spec';
import type { OpenPkg, SemverBump, SpecDocDrift, SpecExport, SpecSchema } from '@openpkg-ts/spec';

/**
 * Extract type string from schema for display
 */
function extractReturnType(schema: SpecSchema | undefined): string {
  if (!schema) return 'void';
  if (typeof schema === 'string') return schema;
  if (typeof schema === 'object') {
    const s = schema as Record<string, unknown>;
    if (typeof s.type === 'string') return s.type;
    if (typeof s.$ref === 'string') {
      const ref = s.$ref as string;
      return ref.startsWith('#/types/') ? ref.slice('#/types/'.length) : ref;
    }
  }
  return 'unknown';
}

export interface PRCommentOptions {
  /** GitHub repo URL for file links (e.g. "https://github.com/org/repo") */
  repoUrl?: string;
  /** Commit SHA for blob links */
  sha?: string;
  /** Target coverage percentage from config/action */
  minCoverage?: number;
  /** Max items per section (default 10) */
  limit?: number;
  /** Include badge snippet in comment */
  includeBadge?: boolean;
  /** Stale markdown doc references */
  staleDocsRefs?: Array<{ file: string; line: number; exportName: string }>;
  /** Number of auto-fixable drift issues */
  fixableDriftCount?: number;
  /** Semver recommendation */
  semverBump?: { bump: SemverBump; reason: string };
}

export interface PRCommentData {
  diff: SpecDiffWithDocs;
  baseName: string;
  headName: string;
  /** Head spec for detailed export/drift info */
  headSpec?: OpenPkg;
  /** DocCov spec for drift/coverage lookup */
  doccov?: DocCovSpec;
}

/**
 * Render a PR comment from diff data
 */
export function renderPRComment(data: PRCommentData, opts: PRCommentOptions = {}): string {
  const { diff, headSpec, doccov } = data;
  const limit = opts.limit ?? 10;
  const lines: string[] = [];

  // Determine status
  const hasStaleRefs = (opts.staleDocsRefs?.length ?? 0) > 0;
  const hasIssues =
    diff.newUndocumented.length > 0 ||
    diff.driftIntroduced > 0 ||
    diff.breaking.length > 0 ||
    hasStaleRefs ||
    (opts.minCoverage !== undefined && diff.newCoverage < opts.minCoverage);

  const statusIcon = hasIssues ? (diff.coverageDelta < 0 ? '❌' : '⚠️') : '✅';

  // Header
  lines.push(`## ${statusIcon} DocCov — Documentation Coverage`);
  lines.push('');

  // Summary metrics
  const targetStr =
    opts.minCoverage !== undefined
      ? ` (target: ${opts.minCoverage}%) ${diff.newCoverage >= opts.minCoverage ? '✅' : '❌'}`
      : '';
  lines.push(`**Patch coverage:** ${diff.newCoverage}%${targetStr}`);

  if (diff.newUndocumented.length > 0) {
    lines.push(`**New undocumented exports:** ${diff.newUndocumented.length}`);
  }

  if (diff.driftIntroduced > 0) {
    lines.push(`**Doc drift issues:** ${diff.driftIntroduced}`);
  }

  if (opts.staleDocsRefs && opts.staleDocsRefs.length > 0) {
    lines.push(`**Stale doc references:** ${opts.staleDocsRefs.length}`);
  }

  // Semver recommendation
  if (opts.semverBump) {
    const emoji =
      opts.semverBump.bump === 'major' ? '🔴' : opts.semverBump.bump === 'minor' ? '🟡' : '🟢';
    lines.push(
      `**Semver:** ${emoji} ${opts.semverBump.bump.toUpperCase()} (${opts.semverBump.reason})`,
    );
  }

  // Undocumented exports section
  if (diff.newUndocumented.length > 0) {
    lines.push('');
    lines.push('### Undocumented exports in this PR');
    lines.push('');
    renderUndocumentedExports(lines, diff.newUndocumented, headSpec, opts, limit);
  }

  // Doc drift section
  if (diff.driftIntroduced > 0 && headSpec) {
    lines.push('');
    lines.push('### Doc drift detected');
    lines.push('');
    renderDriftIssues(lines, diff.newUndocumented, headSpec, doccov, opts, limit);
  }

  // Stale docs references section
  if (opts.staleDocsRefs && opts.staleDocsRefs.length > 0) {
    lines.push('');
    lines.push('### 📝 Stale documentation references');
    lines.push('');
    lines.push('These markdown files reference exports that no longer exist:');
    lines.push('');
    renderStaleDocsRefs(lines, opts.staleDocsRefs, opts, limit);
  }

  // How to fix section (contextual)
  const fixGuidance = renderFixGuidance(diff, opts);
  if (fixGuidance) {
    lines.push('');
    lines.push('### How to fix');
    lines.push('');
    lines.push(fixGuidance);
  }

  // Collapsible details
  lines.push('');
  lines.push('<details>');
  lines.push('<summary>View full report</summary>');
  lines.push('');
  renderDetailsTable(lines, diff);
  lines.push('');
  lines.push('</details>');

  // Badge snippet (if repo URL provided)
  if (opts.includeBadge !== false && opts.repoUrl) {
    const repoMatch = opts.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (repoMatch) {
      const [, owner, repo] = repoMatch;
      lines.push('');
      lines.push('---');
      lines.push('');
      lines.push(
        `[![DocCov](https://doccov.dev/badge/${owner}/${repo})](https://doccov.dev/${owner}/${repo})`,
      );
    }
  }

  return lines.join('\n');
}

/**
 * Render undocumented exports grouped by file
 */
function renderUndocumentedExports(
  lines: string[],
  undocumented: string[],
  headSpec: OpenPkg | undefined,
  opts: PRCommentOptions,
  limit: number,
): void {
  if (!headSpec) {
    // Fallback: just list names
    for (const name of undocumented.slice(0, limit)) {
      lines.push(`- \`${name}\``);
    }
    if (undocumented.length > limit) {
      lines.push(`- _...and ${undocumented.length - limit} more_`);
    }
    return;
  }

  // Group exports by file
  const byFile = new Map<string, SpecExport[]>();
  const undocSet = new Set(undocumented);

  for (const exp of headSpec.exports) {
    if (undocSet.has(exp.name)) {
      const file = exp.source?.file ?? 'unknown';
      const list = byFile.get(file) ?? [];
      list.push(exp);
      byFile.set(file, list);
    }
  }

  let count = 0;
  for (const [file, exports] of byFile) {
    if (count >= limit) break;

    const fileLink = buildFileLink(file, opts);
    lines.push(`📁 ${fileLink}`);

    for (const exp of exports) {
      if (count >= limit) {
        lines.push(`- _...and more_`);
        break;
      }

      const sig = formatExportSignature(exp);
      lines.push(`- \`${sig}\``);

      // List missing signals
      const missing = getMissingSignals(exp);
      if (missing.length > 0) {
        lines.push(`  - Missing: ${missing.join(', ')}`);
      }

      count++;
    }
    lines.push('');
  }

  if (undocumented.length > count) {
    lines.push(`_...and ${undocumented.length - count} more undocumented exports_`);
  }
}

/**
 * Render drift issues from head spec using doccov lookup
 */
function renderDriftIssues(
  lines: string[],
  _undocumented: string[],
  headSpec: OpenPkg,
  doccov: DocCovSpec | undefined,
  opts: PRCommentOptions,
  limit: number,
): void {
  const driftIssues: { exportName: string; file?: string; drift: SpecDocDrift }[] = [];

  // Collect drift from all exports using doccov lookup
  for (const exp of headSpec.exports) {
    const drifts = doccov ? getExportDrift(exp, doccov) : [];
    for (const d of drifts) {
      driftIssues.push({
        exportName: exp.name,
        file: exp.source?.file,
        drift: d as SpecDocDrift,
      });
    }
  }

  if (driftIssues.length === 0) {
    lines.push('_No specific drift details available_');
    return;
  }

  for (const issue of driftIssues.slice(0, limit)) {
    const fileRef = issue.file ? `\`${issue.file}\`` : 'unknown file';
    const fileLink = issue.file ? buildFileLink(issue.file, opts) : fileRef;

    lines.push(`⚠️ ${fileLink}: \`${issue.exportName}\``);
    lines.push(`- ${issue.drift.issue}`);
    if (issue.drift.suggestion) {
      lines.push(`- Fix: ${issue.drift.suggestion}`);
    }
    lines.push('');
  }

  if (driftIssues.length > limit) {
    lines.push(`_...and ${driftIssues.length - limit} more drift issues_`);
  }
}

/**
 * Build file link with optional GitHub URL
 */
function buildFileLink(file: string, opts: PRCommentOptions): string {
  if (opts.repoUrl && opts.sha) {
    const url = `${opts.repoUrl}/blob/${opts.sha}/${file}`;
    return `[\`${file}\`](${url})`;
  }
  return `\`${file}\``;
}

/**
 * Get export keyword from kind
 */
function getExportKeyword(kind: string): string {
  switch (kind) {
    case 'type':
      return 'type';
    case 'interface':
      return 'interface';
    case 'class':
      return 'class';
    default:
      return 'function';
  }
}

/**
 * Format export signature for display
 */
function formatExportSignature(exp: SpecExport): string {
  const prefix = `export ${getExportKeyword(exp.kind)}`;

  if (exp.kind === 'function' && exp.signatures?.[0]) {
    const sig = exp.signatures[0];
    const params =
      sig.parameters?.map((p) => `${p.name}${p.required === false ? '?' : ''}`).join(', ') ?? '';
    const ret = extractReturnType(sig.returns?.schema);
    return `${prefix} ${exp.name}(${params}): ${ret}`;
  }

  if (exp.kind === 'type' || exp.kind === 'interface') {
    return `${prefix} ${exp.name}`;
  }

  if (exp.kind === 'class') {
    return `${prefix} ${exp.name}`;
  }

  return `export ${exp.kind} ${exp.name}`;
}

/**
 * Get list of missing documentation signals
 */
function getMissingSignals(exp: SpecExport): string[] {
  const missing: string[] = [];

  if (!exp.description) {
    missing.push('description');
  }

  if (exp.kind === 'function' && exp.signatures?.[0]) {
    const sig = exp.signatures[0];
    const undocParams = sig.parameters?.filter((p) => !p.description) ?? [];
    if (undocParams.length > 0) {
      missing.push(`\`@param ${undocParams.map((p) => p.name).join(', ')}\``);
    }
    if (!sig.returns?.description && extractReturnType(sig.returns?.schema) !== 'void') {
      missing.push('`@returns`');
    }
  }

  return missing;
}

/**
 * Render stale docs references
 */
function renderStaleDocsRefs(
  lines: string[],
  refs: Array<{ file: string; line: number; exportName: string }>,
  opts: PRCommentOptions,
  limit: number,
): void {
  // Group by file
  const byFile = new Map<string, Array<{ line: number; exportName: string }>>();
  for (const ref of refs) {
    const list = byFile.get(ref.file) ?? [];
    list.push({ line: ref.line, exportName: ref.exportName });
    byFile.set(ref.file, list);
  }

  let count = 0;
  for (const [file, fileRefs] of byFile) {
    if (count >= limit) break;

    const fileLink = buildFileLink(file, opts);
    lines.push(`📁 ${fileLink}`);

    for (const ref of fileRefs) {
      if (count >= limit) break;
      lines.push(`- Line ${ref.line}: \`${ref.exportName}\` does not exist`);
      count++;
    }
    lines.push('');
  }

  if (refs.length > count) {
    lines.push(`_...and ${refs.length - count} more stale references_`);
  }
}

/**
 * Render contextual fix guidance based on issue types
 */
function renderFixGuidance(diff: SpecDiffWithDocs, opts: PRCommentOptions): string {
  const sections: string[] = [];

  if (diff.newUndocumented.length > 0) {
    sections.push(
      '**For undocumented exports:**\n' +
        'Add JSDoc/TSDoc blocks with description, `@param`, and `@returns` tags.',
    );
  }

  if (diff.driftIntroduced > 0) {
    const fixableNote =
      opts.fixableDriftCount && opts.fixableDriftCount > 0
        ? `\n\n**Quick fix:** Run \`npx doccov check --fix\` to auto-fix ${opts.fixableDriftCount} issue(s).`
        : '';
    sections.push(
      `**For doc drift:**\nUpdate JSDoc to match current code signatures.${fixableNote}`,
    );
  }

  if (opts.staleDocsRefs && opts.staleDocsRefs.length > 0) {
    sections.push(
      '**For stale docs:**\n' + 'Update or remove code examples that reference deleted exports.',
    );
  }

  if (diff.breaking.length > 0) {
    sections.push(
      '**For breaking changes:**\n' + 'Consider adding a migration guide or updating changelog.',
    );
  }

  if (sections.length === 0) {
    return '';
  }

  sections.push('\nPush your changes — DocCov re-checks automatically.');
  return sections.join('\n\n');
}

/**
 * Render collapsible details table
 */
function renderDetailsTable(lines: string[], diff: SpecDiffWithDocs): void {
  const delta = (n: number) => (n > 0 ? `+${n}` : n === 0 ? '0' : String(n));

  lines.push('| Metric | Before | After | Delta |');
  lines.push('|--------|--------|-------|-------|');
  lines.push(
    `| Coverage | ${diff.oldCoverage}% | ${diff.newCoverage}% | ${delta(diff.coverageDelta)}% |`,
  );
  lines.push(`| Breaking changes | - | ${diff.breaking.length} | - |`);
  lines.push(`| New exports | - | ${diff.nonBreaking.length} | - |`);
  lines.push(`| Undocumented | - | ${diff.newUndocumented.length} | - |`);

  if (diff.driftIntroduced > 0 || diff.driftResolved > 0) {
    const driftDelta = diff.driftIntroduced - diff.driftResolved;
    lines.push(`| Drift | - | - | ${delta(driftDelta)} |`);
  }
}
