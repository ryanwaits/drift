import ReactMarkdown from 'react-markdown';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { DocsCodeBlock } from '@/components/docs-code-block';
import { getDocSlugs } from '@/lib/docs';

/**
 * Resolves a relative `.md` link (optionally with a `#fragment`) to a real
 * `/docs/<slug>` route. If the target doc doesn't actually exist, `exists`
 * comes back false so the caller can avoid linking to a 404.
 */
function resolveDocHref(href: string): { href: string; exists: boolean } {
  if (!href.includes('.md')) return { href, exists: true };
  const [pathPart, hash] = href.split('#');
  const slug = pathPart.replace(/^\.?\//, '').replace(/\.md$/, '');
  const exists = getDocSlugs().includes(slug);
  return { href: `/docs/${slug}${hash ? `#${hash}` : ''}`, exists };
}

export function DocsMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug]}
      components={{
        h1: (props) => (
          <h1
            className="mt-0 mb-5 font-serif text-4xl tracking-tight text-text sm:text-5xl"
            {...props}
          />
        ),
        h2: (props) => (
          <h2
            className="mt-14 mb-4 scroll-mt-24 border-t border-border pt-8 text-xl font-semibold tracking-tight text-text first:mt-0 first:border-t-0 first:pt-0"
            {...props}
          />
        ),
        h3: (props) => (
          <h3 className="mt-8 mb-3 scroll-mt-24 text-base font-semibold text-text" {...props} />
        ),
        p: (props) => <p className="my-4 max-w-[65ch] leading-relaxed text-text" {...props} />,
        a: ({ href, children, ...props }) => {
          if (!href) return <a {...props}>{children}</a>;
          const resolved = resolveDocHref(href);
          if (!resolved.exists) {
            // Points at a doc that doesn't exist yet — render as plain text
            // instead of shipping a link to a 404.
            return <span className="text-text-muted">{children}</span>;
          }
          return (
            <a
              href={resolved.href}
              className="text-text underline decoration-border-strong underline-offset-2 hover:decoration-text"
              {...props}
            >
              {children}
            </a>
          );
        },
        ul: (props) => (
          <ul className="my-4 max-w-[65ch] list-disc space-y-2 pl-6 text-text" {...props} />
        ),
        ol: (props) => (
          <ol className="my-4 max-w-[65ch] list-decimal space-y-2 pl-6 text-text" {...props} />
        ),
        li: (props) => <li className="leading-relaxed" {...props} />,
        blockquote: (props) => (
          <blockquote
            className="my-5 max-w-[65ch] border-l-2 border-border-strong pl-4 text-text-muted"
            {...props}
          />
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = /language-/.test(className || '');
          if (isBlock) {
            return (
              <code className={`font-mono text-sm text-text ${className ?? ''}`} {...props}>
                {children}
              </code>
            );
          }
          return (
            <code
              className="rounded border border-border bg-code-bg px-1.5 py-0.5 font-mono text-[0.85em] text-text"
              {...props}
            >
              {children}
            </code>
          );
        },
        pre: DocsCodeBlock,
        table: (props) => (
          <div className="my-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm" {...props} />
          </div>
        ),
        th: (props) => (
          <th
            className="border-b border-border-strong px-3 py-2 text-left font-semibold text-text"
            {...props}
          />
        ),
        td: (props) => (
          <td className="border-b border-border px-3 py-2 text-text-muted" {...props} />
        ),
        hr: () => <hr className="my-10 border-border" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
