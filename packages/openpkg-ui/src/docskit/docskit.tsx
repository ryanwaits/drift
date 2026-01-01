import React from 'react';
import { DocsKitCode } from './code';
import { DocsKitInlineCode } from './code.inline';

export function addDocsKit<T extends Record<string, React.ElementType | string>>(components: T): T {
  return {
    ...components,
    DocsKitCode,
    DocsKitInlineCode,
    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      return React.createElement(components?.a || 'a', props);
    },
  };
}
