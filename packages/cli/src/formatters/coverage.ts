import { c, progressBar, coverageColor, padRight, padLeft, indent } from '../utils/render';

interface CoverageData {
  score: number;
  documented: number;
  total: number;
  undocumented: string[];
}

export function renderCoverage(data: CoverageData): string {
  const lines: string[] = [''];
  const color = coverageColor(data.score);
  const bar = progressBar(data.score);

  lines.push(indent(`Coverage  ${color(`${data.score}%`)}  ${bar}  (${data.documented}/${data.total})`));
  lines.push('');

  if (data.undocumented.length > 0) {
    lines.push(indent(c.gray('UNDOCUMENTED')));
    const shown = data.undocumented.slice(0, 15);
    for (const name of shown) {
      lines.push(indent(`  ${name}`));
    }
    const remaining = data.undocumented.length - shown.length;
    if (remaining > 0) {
      lines.push(indent(c.gray(`  ... +${remaining} more`)));
    }
  }

  lines.push('');
  lines.push(indent(c.gray('Tip: drift coverage --min 50 in CI to enforce threshold')));
  lines.push('');

  return lines.join('\n');
}
