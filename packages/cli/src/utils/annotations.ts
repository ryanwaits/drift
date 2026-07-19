/**
 * GitHub Actions workflow-command annotations (::error file=…,line=…::message).
 * Opt-in via --annotations: lines go to stdout per GitHub's protocol, so they
 * are never auto-emitted — mixing them into --json output would break naive
 * JSON.parse consumers (MCP, jq pipelines) unless explicitly requested.
 */

export interface AnnotatableIssue {
  export: string;
  issue: string;
  filePath?: string;
  line?: number;
}

function escapeData(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeProperty(value: string): string {
  return escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

export function emitAnnotations(
  issues: AnnotatableIssue[],
  level: 'error' | 'warning' = 'error',
): void {
  for (const issue of issues) {
    const props: string[] = [];
    if (issue.filePath) props.push(`file=${escapeProperty(issue.filePath)}`);
    if (issue.line !== undefined) props.push(`line=${issue.line}`);
    props.push(`title=${escapeProperty(`drift: ${issue.export || 'docs'}`)}`);
    process.stdout.write(`::${level} ${props.join(',')}::${escapeData(issue.issue)}\n`);
  }
}
