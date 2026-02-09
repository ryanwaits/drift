import { c, indent } from '../utils/render';

interface SemverData {
  bump: string;
  reason: string;
}

export function renderSemver(data: SemverData): string {
  const lines: string[] = [];

  // First line = bare word for piping
  lines.push(data.bump);

  // Explanation
  const color = data.bump === 'major' ? c.red : data.bump === 'minor' ? c.yellow : c.green;
  lines.push(color(data.reason));
  lines.push('');

  return lines.join('\n');
}
