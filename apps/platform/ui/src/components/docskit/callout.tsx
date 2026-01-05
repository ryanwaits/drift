import { type AnnotationHandler, type InlineAnnotation, InnerLine } from 'codehike/code';
import { CalloutClient } from './callout.client';

export const callout: AnnotationHandler = {
  name: 'callout',
  transform: (annotation: InlineAnnotation) => {
    // transform inline annotation to block annotation
    const { name, query, lineNumber, fromColumn, toColumn } = annotation;
    return {
      name,
      query,
      fromLineNumber: lineNumber,
      toLineNumber: lineNumber,
      data: {
        ...annotation.data,
        column: (fromColumn + toColumn) / 2,
      },
    };
  },
  AnnotatedLine: ({ annotation, ...props }) => {
    const { column } = annotation.data;
    const { indentation, children } = props;
    return (
      <InnerLine merge={props}>
        {children}
        <div
          style={{
            minWidth: `${column + 4}ch`,
            marginLeft: `${indentation}ch`,
            border: '1px solid var(--ch-23)',
          }}
          className="w-fit bg-dk-tabs-background rounded px-0 relative my-1 whitespace-break-spaces select-none"
        >
          <div
            style={{
              left: `${column - indentation - 1}ch`,
              borderColor: 'var(--ch-23)',
            }}
            className="absolute border-l border-t  w-2 h-2 rotate-45 -translate-y-1/2 -top-[1px] bg-dk-tabs-background"
          />
          <CalloutClient name={annotation.query} />
        </div>
      </InnerLine>
    );
  },
};
