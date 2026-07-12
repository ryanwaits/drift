import { DocsSidebar } from '@/components/docs-sidebar';
import { Nav } from '@/components/nav';
import { getAllDocsMeta } from '@/lib/docs';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = getAllDocsMeta();

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-[180px_1fr] lg:py-16">
        <DocsSidebar docs={docs} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
