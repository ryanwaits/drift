import { c, indent, padRight } from '../utils/render';

interface ConfigListData {
  entries: Array<{ key: string; value: unknown }>;
  configPath: string | null;
}

interface ConfigGetData {
  key: string;
  value: unknown;
}

export function renderConfigList(data: ConfigListData): string {
  const lines: string[] = [''];
  if (data.configPath) {
    lines.push(indent(c.gray(`Source: ${data.configPath}`)));
    lines.push('');
  }
  const maxKey = Math.max(...data.entries.map((e) => e.key.length), 10);
  for (const entry of data.entries) {
    const val = JSON.stringify(entry.value);
    lines.push(indent(`${padRight(entry.key, maxKey)}  ${val}`));
  }
  lines.push('');
  return lines.join('\n');
}

export function renderConfigGet(data: ConfigGetData): string {
  const lines: string[] = [''];
  if (data.value === undefined) {
    lines.push(indent(c.gray(`${data.key} is not set`)));
  } else {
    lines.push(indent(`${data.key} = ${JSON.stringify(data.value)}`));
  }
  lines.push('');
  return lines.join('\n');
}
