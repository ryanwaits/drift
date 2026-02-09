import { c, indent } from '../utils/render';

interface ExtractData {
  exports?: any[];
  types?: Record<string, any> | any[];
  [key: string]: any;
}

export function renderExtract(data: ExtractData): string {
  const exportCount = data.exports?.length ?? 0;
  const typeCount = data.types
    ? Array.isArray(data.types) ? data.types.length : Object.keys(data.types).length
    : 0;

  const lines: string[] = [''];
  lines.push(indent(`${c.green('ok')} Extracted ${exportCount} exports, ${typeCount} types`));
  lines.push('');
  return lines.join('\n');
}
