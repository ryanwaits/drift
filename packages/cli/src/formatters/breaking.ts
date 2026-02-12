import { c, indent, separator, sym } from '../utils/render';

interface BreakingData {
  breaking: Array<{ name: string; reason?: string; severity?: string }>;
  count: number;
}

export function renderBreaking(data: BreakingData): string {
  const lines: string[] = [''];

  if (data.count === 0) {
    lines.push(indent(`${c.green(sym.ok)} No breaking changes`));
    lines.push('');
    return lines.join('\n');
  }

  lines.push(indent(`${c.red(`${data.count} breaking change${data.count === 1 ? '' : 's'}`)}`));
  lines.push('');
  lines.push(indent(c.gray(separator())));

  for (const b of data.breaking) {
    const reason = b.reason ? `  ${b.reason}` : '';
    lines.push(indent(`${c.red(sym.x)} ${b.name}${c.dim(reason)}`));
  }

  lines.push('');
  return lines.join('\n');
}
