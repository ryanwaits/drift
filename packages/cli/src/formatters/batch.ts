import { c, indent } from '../utils/render';

export interface BatchListRow {
  name: string;
  count: number;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

export function renderBatchList(data: {
  packages: BatchListRow[];
  filter?: 'undocumented';
}): string {
  const lines: string[] = [''];
  const rows = data.packages;
  const columnLabel = data.filter === 'undocumented' ? 'UNDOCUMENTED' : 'EXPORTS';

  const nameW = Math.max(7, ...rows.map((r) => r.name.length));
  lines.push(indent(`${c.gray(pad('PACKAGE', nameW))}  ${c.gray(columnLabel)}`));

  for (const r of rows) {
    const countStr =
      data.filter === 'undocumented'
        ? r.count === 0
          ? c.green('0')
          : c.yellow(String(r.count))
        : String(r.count);
    lines.push(indent(`${pad(r.name, nameW)}  ${countStr}`));
  }

  const total = rows.reduce((s, r) => s + r.count, 0);
  lines.push('');
  const label = data.filter === 'undocumented' ? 'undocumented exports' : 'exports';
  lines.push(indent(`${c.bold('Total')}: ${total} ${label} across ${rows.length} packages`));
  lines.push('');
  return lines.join('\n');
}
