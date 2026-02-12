import { c, coverageColor, indent, sym } from '../utils/render';
import { sparkline } from '../utils/sparkline';

interface PackageTrend {
  name: string;
  coverageHistory: number[];
  lintHistory: number[];
  first: number;
  last: number;
  delta: number;
  latestLint: number;
}

interface ReportData {
  trends: PackageTrend[];
  attention: PackageTrend[];
  totalEntries: number;
  min: number;
}

export function renderReport(data: ReportData): string {
  const lines: string[] = [''];

  lines.push(indent(c.bold('Drift Report')));
  lines.push(indent(c.gray(`${data.totalEntries} history entries`)));
  lines.push('');

  // Coverage trends
  for (const trend of data.trends) {
    const color = coverageColor(trend.last);
    const spark = sparkline(trend.coverageHistory);
    const deltaStr = trend.delta >= 0 ? c.green(`+${trend.delta}`) : c.red(`${trend.delta}`);
    lines.push(indent(`${trend.name}`));
    lines.push(indent(`  ${spark}  ${trend.first}% -> ${color(`${trend.last}%`)}  (${deltaStr})`));
    if (trend.latestLint > 0) {
      lines.push(
        indent(
          `  ${c.yellow(`${trend.latestLint} lint issue${trend.latestLint === 1 ? '' : 's'}`)}`,
        ),
      );
    }
  }
  lines.push('');

  // Packages needing attention
  if (data.attention.length > 0) {
    lines.push(indent(c.bold('Needs attention')));
    for (const pkg of data.attention) {
      const reasons: string[] = [];
      if (pkg.last < data.min) reasons.push(`coverage ${pkg.last}% < ${data.min}%`);
      if (pkg.latestLint > 0) reasons.push(`${pkg.latestLint} lint issues`);
      lines.push(indent(`  ${c.red(sym.x)} ${pkg.name}  ${c.dim(reasons.join(', '))}`));
    }
    lines.push('');
  } else {
    lines.push(indent(`${c.green(sym.ok)} All packages healthy`));
    lines.push('');
  }

  return lines.join('\n');
}
