import type { AnnotationHandler } from 'codehike/code';
import { callout } from './callout';
import type { CodeOptions } from './code.config';
import { line } from './code.line';
import { collapse } from './collapse';
import { diff } from './diff';
import { expandable } from './expandable';
import { hover } from './hover';
import { lineNumbers } from './line-numbers';
import { link } from './link';
import { mark } from './mark';
import { tooltip } from './tooltip';
import { wordWrap } from './word-wrap';

export function getHandlers(options: CodeOptions) {
  return [
    mark,
    diff,
    line,
    options.lineNumbers && lineNumbers,
    link,
    callout,
    ...collapse,
    expandable,
    hover,
    tooltip,
    options.wordWrap && wordWrap,
  ].filter(Boolean) as AnnotationHandler[];
}
