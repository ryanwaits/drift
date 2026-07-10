import { c, coverageColor, indent, progressBar } from '../utils/render';

interface CoverageData {
  score: number;
  documented: number;
  total: number;
  undocumented: string[];
  /** External re-exports excluded from `total` (docs not resolvable here) */
  external?: number;
}

export function renderCoverage(data: CoverageData): string {
  const lines: string[] = [''];
  const color = coverageColor(data.score);
  const bar = progressBar(data.score);

  const externalNote = data.external
    ? c.gray(`  +${data.external} external (not resolvable here)`)
    : '';
  lines.push(
    indent(
      `Coverage  ${color(`${data.score}%`)}  ${bar}  (${data.documented}/${data.total})${externalNote}`,
    ),
  );
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
