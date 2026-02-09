import { c, sym, coverageColor, indent, table, padLeft } from '../utils/render';

interface CiData {
  results: Array<{
    name: string;
    coverage: number;
    coveragePass: boolean;
    lintIssues: number;
    lintPass: boolean;
    exports: number;
    pass: boolean;
  }>;
  pass: boolean;
  min: number;
}

export function renderCi(data: CiData): string {
  const lines: string[] = [''];

  lines.push(indent(c.bold('Drift CI')));
  lines.push('');

  const header = ['PACKAGE', 'EXPORTS', 'COVERAGE', 'LINT', 'STATUS'];
  const rows = data.results.map((r) => {
    const color = coverageColor(r.coverage);
    const covStatus = r.coveragePass ? color(`${r.coverage}%`) : c.red(`${r.coverage}%`);
    const lintStatus = r.lintPass ? c.green(`${r.lintIssues}`) : c.red(`${r.lintIssues} issues`);
    const status = r.pass ? c.green(sym.ok) : c.red(sym.x);
    return [r.name, String(r.exports), covStatus, lintStatus, status];
  });

  lines.push(indent(table([header, ...rows])));
  lines.push('');

  if (data.pass) {
    lines.push(indent(`${c.green(sym.ok)} All checks passed`));
  } else {
    const failed = data.results.filter((r) => !r.pass).length;
    lines.push(indent(`${c.red(sym.x)} ${failed} package${failed === 1 ? '' : 's'} failed`));
  }
  lines.push('');

  return lines.join('\n');
}
