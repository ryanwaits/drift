import type { Metadata } from 'next';
import { DocsMarkdown } from '@/components/docs-markdown';
import { getDocContent } from '@/lib/docs';

export const metadata: Metadata = {
  title: 'Docs — drift',
};

export default function DocsIndexPage() {
  const content = getDocContent('guide-map');

  return (
    <div className="max-w-2xl">
      <DocsMarkdown content={content} />
    </div>
  );
}
