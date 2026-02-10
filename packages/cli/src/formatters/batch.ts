import { c, indent } from '../utils/render';

export interface BatchCoverageRow {
  name: string;
  exports: number;
  score: number;
}

export interface BatchLintRow {
  name: string;
  exports: number;
  issues: number;
}

export interface BatchListRow {
  name: string;
  count: number;
}

export function renderBatchCoverage(data: { packages: BatchCoverageRow[]; aggregate: { score: number; documented: number; total: number }; skipped?: string[] }): string {
  const lines: string[] = [''];
  const rows = data.packages;

  // Header
  const nameW = Math.max(7, ...rows.map((r) => r.name.length));
  lines.push(indent(`${c.gray(pad('PACKAGE', nameW))}  ${c.gray(pad('EXPORTS', 7))}  ${c.gray('COVERAGE')}`));

  for (const r of rows) {
    const score = r.score === 100 ? c.green(`${r.score}%`) : r.score >= 80 ? c.yellow(`${r.score}%`) : c.red(`${r.score}%`);
    lines.push(indent(`${pad(r.name, nameW)}  ${pad(String(r.exports), 7)}  ${score}`));
  }

  lines.push('');
  lines.push(indent(`${c.bold('Total')}: ${data.aggregate.score}% (${data.aggregate.documented}/${data.aggregate.total})`));
  if (data.skipped && data.skipped.length > 0) {
    lines.push(indent(`${c.gray(`Skipped ${data.skipped.length} private: ${data.skipped.join(', ')}`)}`));
  }
  lines.push('');
  return lines.join('\n');
}

export function renderBatchLint(data: { packages: BatchLintRow[]; aggregate: { count: number }; skipped?: string[] }): string {
  const lines: string[] = [''];
  const rows = data.packages;

  const nameW = Math.max(7, ...rows.map((r) => r.name.length));
  lines.push(indent(`${c.gray(pad('PACKAGE', nameW))}  ${c.gray(pad('EXPORTS', 7))}  ${c.gray('ISSUES')}`));

  for (const r of rows) {
    const issues = r.issues === 0 ? c.green('0') : c.red(String(r.issues));
    lines.push(indent(`${pad(r.name, nameW)}  ${pad(String(r.exports), 7)}  ${issues}`));
  }

  lines.push('');
  lines.push(indent(`${c.bold('Total')}: ${data.aggregate.count} issue${data.aggregate.count === 1 ? '' : 's'}`));
  if (data.skipped && data.skipped.length > 0) {
    lines.push(indent(`${c.gray(`Skipped ${data.skipped.length} private: ${data.skipped.join(', ')}`)}`));
  }
  lines.push('');
  return lines.join('\n');
}

export function renderBatchList(data: { packages: BatchListRow[] }): string {
  const lines: string[] = [''];
  const rows = data.packages;

  const nameW = Math.max(7, ...rows.map((r) => r.name.length));
  lines.push(indent(`${c.gray(pad('PACKAGE', nameW))}  ${c.gray('EXPORTS')}`));

  for (const r of rows) {
    lines.push(indent(`${pad(r.name, nameW)}  ${r.count}`));
  }

  const total = rows.reduce((s, r) => s + r.count, 0);
  lines.push('');
  lines.push(indent(`${c.bold('Total')}: ${total} exports across ${rows.length} packages`));
  lines.push('');
  return lines.join('\n');
}

export interface BatchExamplesRow {
  name: string;
  exports: number;
  score: number;
}

export function renderBatchExamples(data: { packages: BatchExamplesRow[]; aggregate: { score: number; withExamples: number; total: number }; skipped?: string[] }): string {
  const lines: string[] = [''];
  const rows = data.packages;

  const nameW = Math.max(7, ...rows.map((r) => r.name.length));
  lines.push(indent(`${c.gray(pad('PACKAGE', nameW))}  ${c.gray(pad('EXPORTS', 7))}  ${c.gray('EXAMPLES')}`));

  for (const r of rows) {
    const score = r.score === 100 ? c.green(`${r.score}%`) : r.score >= 80 ? c.yellow(`${r.score}%`) : c.red(`${r.score}%`);
    lines.push(indent(`${pad(r.name, nameW)}  ${pad(String(r.exports), 7)}  ${score}`));
  }

  lines.push('');
  lines.push(indent(`${c.bold('Total')}: ${data.aggregate.score}% (${data.aggregate.withExamples}/${data.aggregate.total})`));
  if (data.skipped && data.skipped.length > 0) {
    lines.push(indent(`${c.gray(`Skipped ${data.skipped.length} private: ${data.skipped.join(', ')}`)}`));
  }
  lines.push('');
  return lines.join('\n');
}

function pad(s: string, w: number): string {
  return s + ' '.repeat(Math.max(0, w - s.length));
}
