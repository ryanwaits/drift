import type { AnnotationHandler, BlockAnnotation } from 'codehike/code';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/collapsible/collapsible';

export const expandable: AnnotationHandler = {
  name: 'expandable',
  transform: (annotation: BlockAnnotation) => {
    return { ...annotation, toLineNumber: 999 };
  },
  Block: ({ children }) => {
    return (
      <Collapsible>
        <CollapsibleTrigger className="h-24 w-full translate-y-[-75%] absolute bg-gradient-to-b from-dk-background/0 via-dk-background/80 to-dk-background data-[state=open]:invisible">
          <div className="pt-6">Expand</div>
        </CollapsibleTrigger>
        <CollapsibleContent>{children}</CollapsibleContent>
      </Collapsible>
    );
  },
};
