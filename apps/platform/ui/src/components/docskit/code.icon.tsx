import { TerminalIcon } from 'lucide-react';
import { themeIcons } from 'seti-icons';

export function CodeIcon({
  title,
  lang,
  className,
}: {
  title: string;
  lang: string;
  className?: string;
}): React.ReactNode {
  if (
    title?.toLowerCase() === 'terminal output' ||
    title?.toLowerCase() === 'terminal' ||
    lang === 'sh' ||
    lang === 'shell' ||
    lang === 'bash'
  ) {
    return <TerminalIcon size={16} className={className} style={{ marginTop: -3.5 }} />;
  }

  const ext = lang === 'rust' ? 'rs' : lang === 'typescript' ? 'ts' : lang;
  const filename = `x.${ext}`;

  const { svg } = getIcon(filename);
  const __html = svg.replace(
    /svg/,
    `svg fill='currentColor' style='margin: -4px; height: 24px; width: 24px;'`,
  );
  return (
    <span className={className}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: SVG icons are from trusted seti-ui theme */}
      <span dangerouslySetInnerHTML={{ __html }} style={{ display: 'contents' }} />
    </span>
  );
}

// from https://github.com/jesseweed/seti-ui/blob/master/styles/ui-variables.less
const getIcon = themeIcons({
  white: '#d4d7d6',
  grey: '#4d5a5e',
  'grey-light': '#6d8086',
  blue: '#519aba',
  green: '#8dc149',
  orange: '#e37933',
  pink: '#f55385',
  purple: '#a074c4',
  red: '#cc3e44',
  yellow: '#cbcb41',
  ignore: '#41535b',
});
