import { c, padRight, indent } from '../utils/render';

interface FilterData {
  spec: { exports?: Array<{ name: string; kind?: string; deprecated?: boolean }> };
  matched: number;
  total: number;
}

export function renderFilter(data: FilterData): string {
  const lines: string[] = [''];

  lines.push(indent(`${data.matched} match${data.matched === 1 ? '' : 'es'} of ${data.total} total`));
  lines.push('');

  const exports = data.spec.exports ?? [];
  const shown = exports.slice(0, 20);

  if (shown.length > 0) {
    lines.push(indent(`${c.gray(padRight('NAME', 36))}${c.gray('KIND')}`));
    for (const exp of shown) {
      lines.push(indent(`${padRight(exp.name, 36)}${exp.kind ?? ''}`));
    }
    const remaining = exports.length - shown.length;
    if (remaining > 0) {
      lines.push(indent(c.gray(`... +${remaining} more`)));
    }
  }

  lines.push('');
  return lines.join('\n');
}
