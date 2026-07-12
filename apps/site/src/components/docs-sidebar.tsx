'use client';

import { usePathname } from 'next/navigation';
import type { DocMeta } from '@/lib/docs';

export function DocsSidebar({ docs }: { docs: DocMeta[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
      <p className="mb-3 font-mono text-xs tracking-wide text-text-muted uppercase">Guides</p>
      <ul className="space-y-1 text-sm">
        {docs.map((doc) => {
          const href = `/docs/${doc.slug}`;
          const active = pathname === href;
          return (
            <li key={doc.slug}>
              <a
                href={href}
                className={
                  active
                    ? 'block font-medium text-text'
                    : 'block text-text-muted transition-colors hover:text-text'
                }
              >
                {doc.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
