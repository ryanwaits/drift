import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Compact markdown renderer for changelog bullet text — no large display
 * headings, tuned for dense list entries rather than long-form articles.
 */
export function ChangelogMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (props) => <p className="mt-3 mb-1 font-semibold text-text" {...props} />,
        h2: (props) => <p className="mt-3 mb-1 font-semibold text-text" {...props} />,
        h3: (props) => <p className="mt-3 mb-1 font-semibold text-text" {...props} />,
        p: (props) => <p className="my-2 leading-relaxed text-text-muted" {...props} />,
        a: (props) => (
          <a
            className="text-text underline decoration-border-strong underline-offset-2 hover:decoration-text"
            {...props}
          />
        ),
        strong: (props) => <strong className="font-semibold text-text" {...props} />,
        ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5 text-text-muted" {...props} />,
        ol: (props) => (
          <ol className="my-2 list-decimal space-y-1 pl-5 text-text-muted" {...props} />
        ),
        li: (props) => <li className="leading-relaxed" {...props} />,
        code: ({ className, children, ...props }) => {
          const isBlock = /language-/.test(className || '');
          if (isBlock) {
            return (
              <code className="font-mono text-text text-xs" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code
              className="rounded border border-border bg-code-bg px-1 py-0.5 font-mono text-[0.85em] text-text"
              {...props}
            >
              {children}
            </code>
          );
        },
        pre: (props) => (
          <pre
            className="my-2 overflow-x-auto rounded-lg border border-border bg-code-bg p-3"
            {...props}
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
