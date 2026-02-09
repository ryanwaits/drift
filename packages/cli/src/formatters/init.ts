import { c, sym, coverageColor, indent, table, padLeft } from '../utils/render';

interface InitData {
  packages: Array<{ name: string; entry: string; exports: number; coverage: number }>;
  config: object;
  configPath: string;
  ciPath: string | null;
  isMonorepo: boolean;
}

export function renderInit(data: InitData): string {
  const lines: string[] = [''];

  // Scan table
  lines.push(indent(`${data.isMonorepo ? 'Monorepo' : 'Project'} scan  ${c.gray(`${data.packages.length} package${data.packages.length === 1 ? '' : 's'}`)}`));
  lines.push('');

  const header = ['PACKAGE', 'ENTRY', 'EXPORTS', 'COVERAGE'];
  const rows = data.packages.map((pkg) => {
    const color = coverageColor(pkg.coverage);
    return [pkg.name, pkg.entry, String(pkg.exports), color(`${pkg.coverage}%`)];
  });
  lines.push(indent(table([header, ...rows])));
  lines.push('');

  // Created files
  lines.push(indent(`${c.green(sym.ok)} Created ${data.configPath}`));
  if (data.ciPath) {
    lines.push(indent(`${c.green(sym.ok)} Created ${data.ciPath}`));
  }
  lines.push('');

  // Next step
  lines.push(indent(c.gray('Run `drift` to see your documentation health')));
  lines.push('');

  return lines.join('\n');
}
