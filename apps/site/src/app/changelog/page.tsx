import type { Metadata } from 'next';
import { ChangelogMarkdown } from '@/components/changelog-markdown';
import { Nav } from '@/components/nav';
import { getChangelogPage } from '@/lib/changelog';

export const metadata: Metadata = {
  title: 'Changelog — drift',
};

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const requestedPage = Number(pageParam);
  const { entries, totalPages, page } = getChangelogPage(
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  );

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-serif text-4xl text-text">Changelog</h1>
        <p className="mt-3 text-text-muted">
          Every release, straight from the changesets. Newest first.
        </p>

        <div className="mt-10">
          {entries.map((entry) => (
            <article
              key={entry.version}
              className="border-t border-border py-8 first:border-t-0 first:pt-0"
            >
              <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs text-text-muted">
                v{entry.version}
              </span>
              <div className="mt-4 space-y-5">
                {entry.bullets.map((bullet, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: bullets have no stable id
                  <div key={i}>
                    <span className="font-mono text-[10px] tracking-wide text-text-muted uppercase">
                      {bullet.kind}
                    </span>
                    <ChangelogMarkdown content={bullet.text} />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <nav className="mt-4 flex items-center justify-between border-t border-border pt-6 text-sm">
          {page > 1 ? (
            <a href={`/changelog?page=${page - 1}`} className="text-text-muted hover:text-text">
              ← Newer
            </a>
          ) : (
            <span />
          )}
          <span className="text-text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <a href={`/changelog?page=${page + 1}`} className="text-text-muted hover:text-text">
              Older →
            </a>
          ) : (
            <span />
          )}
        </nav>
      </main>
    </div>
  );
}
