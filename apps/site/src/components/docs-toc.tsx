'use client';

import { useEffect, useState } from 'react';
import type { DocHeading } from '@/lib/docs';

export function DocsToc({ headings }: { headings: DocHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-96px 0px -70% 0px' },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav className="hidden xl:sticky xl:top-20 xl:block xl:self-start">
      <p className="mb-3 font-mono text-xs tracking-wide text-text-muted uppercase">On this page</p>
      <ul className="space-y-2.5 text-sm">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.depth === 3 ? 'pl-3' : undefined}>
            <a
              href={`#${heading.id}`}
              className={
                activeId === heading.id
                  ? 'block font-medium text-text'
                  : 'block text-text-muted transition-colors hover:text-text'
              }
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
