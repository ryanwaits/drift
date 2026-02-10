import { c, indent } from '../utils/render';

interface ContextOutput {
  path: string;
  packages: string[];
  generated: string;
}

export function renderContext(data: ContextOutput): string {
  const lines: string[] = [''];
  lines.push(indent(`${c.green('ok')} Context generated`));
  lines.push('');
  lines.push(indent(`${c.gray('Path')}      ${data.path}`));
  lines.push(indent(`${c.gray('Packages')}  ${data.packages.length}`));
  lines.push('');
  return lines.join('\n');
}
