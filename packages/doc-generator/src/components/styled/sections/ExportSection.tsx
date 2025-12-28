'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';
import { ClassSection } from './ClassSection';
import { EnumSection } from './EnumSection';
import { FunctionSection } from './FunctionSection';
import { InterfaceSection } from './InterfaceSection';
import { VariableSection } from './VariableSection';

export interface ExportSectionProps {
  export: SpecExport;
  spec: OpenPkg;
}

/**
 * Router component that renders the appropriate section based on export kind.
 * Used by FullAPIReferencePage to render each export inline.
 */
export function ExportSection({ export: exp, spec }: ExportSectionProps): ReactNode {
  const props = { export: exp, spec };

  switch (exp.kind) {
    case 'function':
      return <FunctionSection {...props} />;
    case 'class':
      return <ClassSection {...props} />;
    case 'interface':
    case 'type':
      return <InterfaceSection {...props} />;
    case 'enum':
      return <EnumSection {...props} />;
    default:
      return <VariableSection {...props} />;
  }
}
