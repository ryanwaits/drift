'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';
import { VariableSection } from './sections/VariableSection';

export interface VariablePageProps {
  export: SpecExport;
  spec: OpenPkg;
}

/**
 * Stripe-style variable/constant page with two-column layout.
 */
export function VariablePage({
  export: exp,
  spec,
}: VariablePageProps): ReactNode {
  return (
    <div className="doccov-variable-page not-prose">
      <VariableSection export={exp} spec={spec} />
    </div>
  );
}
