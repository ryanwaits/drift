import { c, sym, padRight, indent } from '../utils/render';

interface ListExport {
  name: string;
  kind: string;
  description?: string;
  deprecated?: boolean;
}

interface ListData {
  exports: ListExport[];
  search?: string;
  showAll?: boolean;
}

export function renderList(data: ListData): string {
  const lines: string[] = [''];
  const exports = data.exports;
  const total = exports.length;

  // Header
  if (data.search) {
    lines.push(`  ${total} match${total === 1 ? '' : 'es'} for "${data.search}"`);
  } else {
    lines.push(`  ${c.bold(`${total} exports`)}`);
  }
  lines.push('');

  // Kind summary (skip when searching — saves vertical space)
  if (!data.search) {
    const kindCounts = new Map<string, number>();
    for (const exp of exports) {
      kindCounts.set(exp.kind, (kindCounts.get(exp.kind) ?? 0) + 1);
    }

    lines.push(indent(`${c.gray(padRight('KIND', 14))}${c.gray('COUNT')}`));
    for (const [kind, count] of [...kindCounts.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(indent(`${padRight(kind, 14)}${count}`));
    }
    lines.push('');
  }

  // Export table
  const limit = data.showAll ? exports.length : 10;
  const shown = exports.slice(0, limit);
  const remaining = total - shown.length;

  lines.push(indent(`${c.gray(padRight('NAME', 36))}${c.gray(padRight('KIND', 14))}${c.gray('DOCS')}`));
  for (const exp of shown) {
    const name = exp.deprecated ? c.dim(exp.name) : exp.name;
    const docsStatus = exp.description
      ? exp.deprecated ? c.yellow('deprecated') : c.green(sym.ok)
      : c.gray(sym.dash);
    lines.push(indent(`${padRight(name, 36)}${padRight(exp.kind, 14)}${docsStatus}`));
  }

  if (remaining > 0) {
    lines.push(indent(`${c.gray('...')}${' '.repeat(33)}${' '.repeat(14)}${c.gray(`+${remaining} more`)}`));
  }

  lines.push('');

  // Tips (only when not searching)
  if (!data.search) {
    lines.push(indent(c.gray('Tip: drift list <search>  to filter by name')));
    lines.push(indent(c.gray('     drift list --kind function  to filter by kind')));
  }

  lines.push('');
  return lines.join('\n');
}
