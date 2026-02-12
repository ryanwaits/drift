import { type AnnotationHandler, InnerLine } from 'codehike/code';

export const diff: AnnotationHandler = {
  name: 'diff',
  onlyIfAnnotated: true,
  Block: ({ annotation, children }) => {
    const color = annotation.query === '-' ? '#f85149' : '#3fb950';
    return (
      <div
        style={{
          ['--openpkg-line-bg' as string]: `rgb(from ${color} r g b / 0.13)`,
          ['--openpkg-line-border' as string]: color,
        }}
      >
        {children}
      </div>
    );
  },
  Line: ({ annotation, ...props }) => (
    <>
      <div className="min-w-[1ch] box-content opacity-70 pl-2 select-none">{annotation?.query}</div>
      <InnerLine merge={props} />
    </>
  ),
};
