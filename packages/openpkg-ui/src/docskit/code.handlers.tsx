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
// import { fold } from "./fold"
// import { tokenTransitions } from "./token-transitions"

export function getHandlers(options: CodeOptions) {
  return [
    line,
    options.lineNumbers && lineNumbers,
    mark,
    diff,
    link,
    callout,
    ...collapse,
    expandable,
    hover,
    tooltip,
    options.wordWrap && wordWrap,
    // fold,
    // options.animate && tokenTransitions,
  ].filter(Boolean) as AnnotationHandler[];
}
