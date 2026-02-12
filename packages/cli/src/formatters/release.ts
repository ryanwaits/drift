import { c, coverageColor, indent, progressBar, sym } from '../utils/render';

interface ReleaseData {
  ready: boolean;
  coverage: number;
  coveragePass: boolean;
  lintIssues: number;
  lintPass: boolean;
  total: number;
  documented: number;
  undocumented: string[];
  reasons: string[];
  lastTag: string | null;
  pkgVersion: string | null;
  semverWarning: string | null;
  min: number;
}

export function renderRelease(data: ReleaseData): string {
  const lines: string[] = [''];

  lines.push(indent(c.bold('Release Audit')));
  if (data.pkgVersion) lines.push(indent(c.gray(`v${data.pkgVersion}`)));
  lines.push('');

  // Coverage
  const covColor = coverageColor(data.coverage);
  const covIcon = data.coveragePass ? c.green(sym.ok) : c.red(sym.x);
  lines.push(
    indent(
      `${covIcon} Coverage  ${covColor(`${data.coverage}%`)}  ${progressBar(data.coverage)}  (${data.documented}/${data.total})`,
    ),
  );

  // Lint
  const lintIcon = data.lintPass ? c.green(sym.ok) : c.red(sym.x);
  lines.push(
    indent(
      `${lintIcon} Lint      ${data.lintPass ? c.green('clean') : c.red(`${data.lintIssues} issue${data.lintIssues === 1 ? '' : 's'}`)}`,
    ),
  );

  lines.push('');

  // Top undocumented
  if (data.undocumented.length > 0) {
    lines.push(indent(c.gray('Top undocumented exports')));
    for (const name of data.undocumented) {
      lines.push(indent(`  ${c.dim(sym.minus)} ${name}`));
    }
    lines.push('');
  }

  // Verdict
  if (data.ready) {
    lines.push(indent(`${c.green(sym.ok)} Ready to publish.`));
  } else {
    lines.push(indent(`${c.red(sym.x)} Not ready.`));
    for (const reason of data.reasons) {
      lines.push(indent(`  ${c.dim(sym.minus)} ${reason}`));
    }
  }
  lines.push('');

  return lines.join('\n');
}
