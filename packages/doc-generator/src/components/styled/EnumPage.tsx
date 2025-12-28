'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';
import { EnumSection } from './sections/EnumSection';

export interface EnumPageProps {
  export: SpecExport;
  spec: OpenPkg;
}

/**
 * Stripe-style enum page with two-column layout.
 */
export function EnumPage({ export: exp, spec }: EnumPageProps): ReactNode {
  return (
    <div className="doccov-enum-page not-prose">
      <EnumSection export={exp} spec={spec} />
    </div>
  );
}
