'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';
import { InterfaceSection } from './sections/InterfaceSection';

export interface InterfacePageProps {
  export: SpecExport;
  spec: OpenPkg;
}

/**
 * Stripe-style interface/type page with two-column layout.
 * Left: properties, methods. Right: sticky code examples.
 */
export function InterfacePage({ export: exp, spec }: InterfacePageProps): ReactNode {
  return (
    <div className="doccov-interface-page not-prose">
      <InterfaceSection export={exp} spec={spec} />
    </div>
  );
}
