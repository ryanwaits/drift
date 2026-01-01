import { highlight, Inline, type RawCode } from 'codehike/code';
import { theme } from './code.config';

export async function DocsKitInlineCode({ codeblock }: { codeblock: RawCode }) {
  const highlighted = await highlight(codeblock, theme);
  return (
    <Inline
      code={highlighted}
      className="selection:bg-dk-selection selection:text-current rounded border border-dk-border px-1 py-0.5 whitespace-nowrap !bg-dk-background"
      style={highlighted.style}
    />
  );
}
