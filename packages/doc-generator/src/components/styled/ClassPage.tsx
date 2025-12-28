'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';
import { ClassSection } from './sections/ClassSection';

export interface ClassPageProps {
  export: SpecExport;
  spec: OpenPkg;
}

/**
 * Stripe-style class page with two-column layout.
 * Left: constructor, methods, properties. Right: sticky code examples.
 */
export function ClassPage({ export: exp, spec }: ClassPageProps): ReactNode {
  return (
    <div className="doccov-class-page not-prose">
      <ClassSection export={exp} spec={spec} />
    </div>
  );
}
