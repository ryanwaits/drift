import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsMarkdown } from '@/components/docs-markdown';
import { DocsToc } from '@/components/docs-toc';
import { getDocContent, getDocHeadings, getDocMeta, getDocSlugs } from '@/lib/docs';

export function generateStaticParams(): { slug: string }[] {
  return getDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!getDocSlugs().includes(slug)) return {};
  const { title } = getDocMeta(slug);
  return { title: `${title} — drift docs` };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getDocSlugs().includes(slug)) {
    notFound();
  }
  const content = getDocContent(slug);
  const headings = getDocHeadings(content);

  return (
    <div className="grid grid-cols-1 gap-10 xl:grid-cols-[1fr_180px]">
      <div className="max-w-2xl">
        <DocsMarkdown content={content} />
      </div>
      <DocsToc headings={headings} />
    </div>
  );
}
