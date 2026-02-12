import type { AnnotationHandler, CodeAnnotation } from 'codehike/code';
import type React from 'react';
import { Hoverable, HoverBlock, HoverInline, HoverLine, HoverProvider } from './hover.client';

export function WithHover(props: { children: React.ReactNode }): React.ReactNode {
  return <HoverProvider>{props.children}</HoverProvider>;
}

export function HoverLink(props: { href?: string; children?: React.ReactNode }): React.ReactNode {
  const hover = props.href?.slice('hover:'.length) ?? '';
  return (
    <Hoverable
      className="underline decoration-dotted underline-offset-4 inline cursor-help"
      name={hover}
    >
      {props.children}
    </Hoverable>
  );
}

export const hover: AnnotationHandler = {
  name: 'hover',
  onlyIfAnnotated: true,
  Block: HoverBlock,
  Line: HoverLine,
  Inline: HoverInline,
  transform: (annotation: CodeAnnotation) => {
    if (!('fromColumn' in annotation)) {
      return [annotation];
    }
    const blockAnnotation = {
      name: annotation.name,
      query: annotation.query,
      fromLineNumber: annotation.lineNumber,
      toLineNumber: annotation.lineNumber,
      data: { inline: true },
    };
    return [blockAnnotation, annotation];
  },
};
