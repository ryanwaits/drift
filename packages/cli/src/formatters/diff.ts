import { c, indent, separator, sym } from '../utils/render';

interface DiffData {
  breaking: Array<{ name: string; reason?: string; severity?: string }>;
  added: string[];
  changed: string[];
  summary: { breaking: number; added: number; changed: number };
}

export function renderDiff(data: DiffData): string {
  const lines: string[] = [''];
  const { summary } = data;

  // Header
  const parts: string[] = [];
  if (summary.breaking > 0) parts.push(c.red(`${summary.breaking} breaking`));
  if (summary.added > 0) parts.push(c.green(`${summary.added} added`));
  if (summary.changed > 0) parts.push(`${summary.changed} changed`);

  if (parts.length === 0) {
    lines.push(indent(`${c.green(sym.ok)} No changes`));
    lines.push('');
    return lines.join('\n');
  }

  lines.push(indent(parts.join(`  ${c.gray(sym.dot)}  `)));
  lines.push('');

  // Breaking
  if (data.breaking.length > 0) {
    lines.push(indent(c.gray('BREAKING')));
    lines.push(indent(c.gray(separator())));
    for (const b of data.breaking) {
      const reason = b.reason ? `  ${b.reason}` : '';
      lines.push(indent(`${c.red(sym.x)} ${b.name}${c.dim(reason)}`));
    }
    lines.push('');
  }

  // Added
  if (data.added.length > 0) {
    lines.push(indent(c.gray('ADDED')));
    lines.push(indent(c.gray(separator())));
    for (const name of data.added) {
      lines.push(indent(`${c.green(sym.plus)} ${name}`));
    }
    lines.push('');
  }

  // Changed
  if (data.changed.length > 0) {
    lines.push(indent(c.gray('CHANGED (docs only)')));
    lines.push(indent(c.gray(separator())));
    for (const name of data.changed) {
      lines.push(indent(`${c.yellow(sym.tilde)} ${name}`));
    }
    lines.push('');
  }

  return lines.join('\n');
}
