import { c, indent } from '../utils/render';

interface ValidateData {
  valid: boolean;
  errors: string[];
}

export function renderValidate(data: ValidateData): string {
  const lines: string[] = [''];

  if (data.valid) {
    lines.push(indent(`${c.green('ok')} Valid spec`));
  } else {
    lines.push(indent(`${c.red('x')} ${data.errors.length} error${data.errors.length === 1 ? '' : 's'}`));
    lines.push('');
    for (const err of data.errors) {
      lines.push(indent(`  ${err}`));
    }
  }

  lines.push('');
  return lines.join('\n');
}
