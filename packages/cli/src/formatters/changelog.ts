interface ChangelogData {
  markdown?: string;
  bump?: string;
  breaking?: Array<{ name: string; reason: string }>;
  added?: string[];
  changed?: string[];
}

export function renderChangelog(data: ChangelogData): string {
  // Markdown format = already human-readable, passthrough
  if (data.markdown) {
    return data.markdown;
  }

  // JSON format data — render as markdown
  const lines: string[] = [];
  if (data.bump) lines.push(`## Changes (${data.bump})`);
  lines.push('');

  if (data.breaking && data.breaking.length > 0) {
    lines.push('### Breaking Changes');
    for (const b of data.breaking) {
      lines.push(`- **${b.name}**: ${b.reason}`);
    }
    lines.push('');
  }

  if (data.added && data.added.length > 0) {
    lines.push('### Added');
    for (const name of data.added) {
      lines.push(`- ${name}`);
    }
    lines.push('');
  }

  if (data.changed && data.changed.length > 0) {
    lines.push('### Changed');
    for (const name of data.changed) {
      lines.push(`- ${name}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
