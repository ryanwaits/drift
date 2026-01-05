import type { AnnotationHandler } from 'codehike/code';
import { NoteTooltip } from './tooltip.client';

export const tooltip: AnnotationHandler = {
  name: 'tooltip',
  Inline: ({ children, annotation }) => {
    const { query } = annotation;
    return <NoteTooltip name={query}>{children}</NoteTooltip>;
  },
};

export function TooltipLink(props: { href?: string; children?: React.ReactNode }): React.ReactNode {
  const name = props.href?.slice('tooltip:'.length) ?? '';
  return <NoteTooltip name={name}>{props.children}</NoteTooltip>;
}
