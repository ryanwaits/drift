import { type AnnotationHandler, InnerLine } from 'codehike/code';

export const line: AnnotationHandler = {
  name: 'line',
  Line: ({ annotation, ...props }) => {
    return (
      <div
        style={{
          borderLeftColor: 'var(--openpkg-line-border, transparent)',
          backgroundColor: 'var(--openpkg-line-bg, transparent)',
          transition: 'background-color 0.3s ease',
        }}
        className="flex border-l-2 border-l-transparent"
      >
        <InnerLine merge={props} className="px-3 flex-1" />
      </div>
    );
  },
};
