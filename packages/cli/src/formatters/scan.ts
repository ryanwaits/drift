import type { ScanResult } from '../commands/scan';
import type { OutputNext } from '../utils/output';
import { c, coverageColor, indent, separator, sym, table } from '../utils/render';

export function renderScan(data: ScanResult, next?: OutputNext): string {
  const lines: string[] = [''];

  if (data.packageName) {
    const ver = data.packageVersion ? ` v${data.packageVersion}` : '';
    lines.push(indent(`${c.bold(data.packageName)}${c.gray(ver)}`));
    lines.push('');
  }

  // Summary — absent in docs-map standalone mode (no package under scan)
  if (data.health !== undefined && data.coverage && data.lint) {
    const hColor = coverageColor(data.health);
    lines.push(indent(`Health     ${hColor(`${data.health}%`)}`));
    const externalNote = data.coverage.external
      ? c.gray(`  +${data.coverage.external} external (not resolvable here)`)
      : '';
    lines.push(
      indent(
        `Coverage   ${coverageColor(data.coverage.score)(`${data.coverage.score}%`)}  (${data.coverage.documented}/${data.coverage.total} exports)${externalNote}`,
      ),
    );
    lines.push(
      indent(
        `Lint       ${data.lint.count === 0 ? c.green('0 issues') : c.red(`${data.lint.count} issues`)}`,
      ),
    );
    lines.push('');
  }

  // Issues (max 10)
  if (data.lint && data.lint.count > 0) {
    lines.push(indent('Issues'));
    lines.push(indent(c.gray(separator())));
    const shown = data.lint.issues.slice(0, 10);
    for (const issue of shown) {
      const loc = issue.filePath
        ? c.dim(` ${issue.filePath}${issue.line ? `:${issue.line}` : ''}`)
        : '';
      lines.push(indent(`${c.red(sym.x)} ${issue.export}  ${c.dim(issue.issue)}${loc}`));
    }
    const remaining = data.lint.count - shown.length;
    if (remaining > 0) {
      lines.push(indent(c.gray(`... ${remaining} more`)));
    }
    lines.push('');
  }

  // Docs key coverage (--docs-map mode)
  if (data.docsCoverage) {
    lines.push(indent('Docs coverage'));
    lines.push(indent(c.gray(separator())));
    for (const page of data.docsCoverage.pages) {
      const mark =
        page.status === 'fail'
          ? c.red(sym.x)
          : page.status === 'warn'
            ? c.yellow('!')
            : c.green(sym.ok);
      const cts = page.counts;
      lines.push(
        indent(
          `${mark} ${page.page}  ${c.dim(`${page.type}: ${cts.documented} documented, ${cts.code} in code, ${cts.gapsUserFacing} gaps, ${cts.ghosts} ghosts, ${cts.inversions} inversions`)}`,
        ),
      );
      for (const f of page.failures) lines.push(indent(`  ${c.red(f)}`));
      for (const w of page.warnings) lines.push(indent(`  ${c.yellow(w)}`));
    }
    lines.push('');
  }

  // Verdict
  if (data.pass) {
    lines.push(indent(`${c.green(sym.ok)} Scan passed`));
  } else {
    lines.push(indent(`${c.red(sym.x)} Scan failed`));
  }
  if (next) {
    lines.push(indent(c.gray(`-> Next: ${next.suggested}  (${next.reason})`)));
  }
  lines.push('');

  return lines.join('\n');
}

interface BatchScanRow {
  name: string;
  exports: number;
  coverage: number;
  lintIssues: number;
  health: number;
}

interface BatchScanData {
  packages: BatchScanRow[];
  skipped?: string[];
}

export function renderBatchScan(data: BatchScanData): string {
  const lines: string[] = [''];

  const headers = ['Package', 'Exports', 'Coverage', 'Lint', 'Health'];
  const rows = data.packages.map((p) => [
    p.name,
    String(p.exports),
    `${p.coverage}%`,
    String(p.lintIssues),
    `${p.health}%`,
  ]);

  lines.push(table([headers, ...rows]));

  if (data.skipped && data.skipped.length > 0) {
    lines.push(
      indent(
        c.gray(
          `Skipped ${data.skipped.length} private package${data.skipped.length === 1 ? '' : 's'}`,
        ),
      ),
    );
  }

  lines.push('');
  return lines.join('\n');
}
