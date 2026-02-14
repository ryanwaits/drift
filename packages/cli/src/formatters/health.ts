import type { HealthResult } from '../utils/health';
import type { OutputNext } from '../utils/output';
import { c, coverageColor, indent, separator, sym } from '../utils/render';

interface HealthData extends HealthResult {
  packageName?: string;
  packageVersion?: string;
  min?: number;
}

export function renderHealth(data: HealthData, next?: OutputNext): string {
  const lines: string[] = [''];

  // 1. Identity
  if (data.packageName) {
    const ver = data.packageVersion ? ` v${data.packageVersion}` : '';
    lines.push(indent(`${c.bold(data.packageName)}${c.gray(ver)}`));
    lines.push('');
  }

  // 2. Score
  const hColor = coverageColor(data.health);
  lines.push(indent(`Health   ${hColor(`${data.health}%`)}`));

  // 3. Breakdown
  lines.push(
    indent(
      `${sym.branch} completeness  ${data.completeness}%  (${data.undocumented} missing docs)`,
    ),
  );
  lines.push(
    indent(`${sym.end} accuracy      ${data.accuracy}%  (${data.drifted} stale signatures)`),
  );
  lines.push('');

  // 4. Counts
  lines.push(
    indent(
      `${data.totalExports} exports  ${c.gray(sym.dot)}  ${data.documented} documented  ${c.gray(sym.dot)}  ${data.drifted} drifted`,
    ),
  );
  lines.push('');

  // 5. Top issues (max 5)
  if (data.issues.length > 0) {
    lines.push(indent('Top issues'));
    lines.push(indent(c.gray(separator())));
    const shown = data.issues.slice(0, 5);
    for (const issue of shown) {
      lines.push(indent(`${c.red(sym.x)} ${issue.export}  ${c.dim(issue.issue)}`));
    }
    const remaining = data.issues.length - shown.length;
    if (remaining > 0) {
      lines.push(indent(c.gray(`... ${remaining} more`)));
    }
    lines.push('');
  }

  // 6. Verdict
  const min = data.min ?? 80;
  if (data.health < min) {
    lines.push(
      indent(`${c.red(sym.x)} Health ${data.health}% below ${min === 80 ? 'default ' : ''}${min}%`),
    );
  } else {
    lines.push(indent(`${c.green(sym.ok)} Health ${data.health}%`));
  }

  // 7. Next step
  if (next) {
    lines.push(indent(c.gray(`-> Next: ${next.suggested}  (${next.reason})`)));
  }
  lines.push('');

  return lines.join('\n');
}
