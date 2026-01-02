'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';
import { FunctionSection } from './sections/FunctionSection';

export interface FunctionPageProps {
  export: SpecExport;
  spec: OpenPkg;
}

/**
 * Stripe-style function page with two-column layout.
 * Left: parameters, returns. Right: sticky code examples.
 */
export function FunctionPage({ export: exp, spec }: FunctionPageProps): ReactNode {
  return (
    <div className="doccov-function-page not-prose">
      <FunctionSection export={exp} spec={spec} />
    </div>
  );
}
