import { c, indent } from '../utils/render';

export function renderCacheStatus(data: {
  dir: string;
  entries: number;
  totalKB: number;
  oldest: string | null;
  newest: string | null;
}): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(indent(`${c.bold('Cache Status')}`));
  lines.push('');
  lines.push(indent(`  Dir:      ${c.gray(data.dir)}`));
  lines.push(indent(`  Entries:  ${data.entries}`));
  lines.push(indent(`  Size:     ${data.totalKB} KB`));
  if (data.newest) {
    lines.push(indent(`  Newest:   ${c.gray(data.newest)}`));
  }
  if (data.oldest) {
    lines.push(indent(`  Oldest:   ${c.gray(data.oldest)}`));
  }
  if (data.entries === 0) {
    lines.push(indent(`  ${c.gray('(empty)')}`));
  }
  lines.push('');
  return lines.join('\n');
}

export function renderCacheClear(data: { removed: number }): string {
  const lines: string[] = [];
  lines.push('');
  if (data.removed > 0) {
    lines.push(
      indent(`${c.green('✓')} Cleared ${data.removed} cached spec${data.removed === 1 ? '' : 's'}`),
    );
  } else {
    lines.push(indent(`${c.gray('Cache already empty')}`));
  }
  lines.push('');
  return lines.join('\n');
}
