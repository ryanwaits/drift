import type { OutputNext } from '../utils/output';
import { c, indent } from '../utils/render';

interface LintIssue {
  export: string;
  issue: string;
  location?: string;
  filePath?: string;
  line?: number;
}

interface LintData {
  issues: LintIssue[];
  count: number;
}

export function renderLint(data: LintData, next?: OutputNext): string {
  const lines: string[] = [''];

  if (data.count === 0) {
    lines.push(indent(`${c.green('ok')} No issues found`));
    lines.push('');
    return lines.join('\n');
  }

  lines.push(indent(`${data.count} issue${data.count === 1 ? '' : 's'}`));
  lines.push('');

  // Group by export
  const grouped = new Map<string, LintIssue[]>();
  for (const issue of data.issues) {
    const existing = grouped.get(issue.export) ?? [];
    existing.push(issue);
    grouped.set(issue.export, existing);
  }

  for (const [exportName, issues] of grouped) {
    lines.push(indent(c.bold(exportName)));
    for (const issue of issues) {
      const loc = issue.filePath
        ? `  ${c.dim(`${issue.filePath}${issue.line ? `:${issue.line}` : ''}`)}`
        : '';
      lines.push(indent(`  ${issue.issue}${loc}`, 2));
    }
    lines.push('');
  }

  lines.push(indent(`${data.count} issue${data.count === 1 ? '' : 's'} found`));
  if (next) {
    lines.push(indent(c.gray(`-> Next: ${next.suggested}  (${next.reason})`)));
  }
  lines.push('');

  return lines.join('\n');
}
