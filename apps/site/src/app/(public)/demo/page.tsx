import { DesignSystemClient } from './client';
import { DocsKitShowcaseWrapper } from './docskit-showcase-wrapper';

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      <div className="container mx-auto px-8 py-12 max-w-5xl">
        <header className="mb-12">
          <h1 className="text-3xl font-semibold text-foreground mb-2">DocCov Design System</h1>
          <p className="text-muted-foreground">Phase 1: Primitives — Warm Monochromatic Palette</p>
        </header>

        {/* 8. DocsKit Code Components (Client) */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-4">8. DocsKit Code</h2>
          <ShowcasePanel>
            <DocsKitShowcaseWrapper />
          </ShowcasePanel>
        </section>

        {/* Client-side interactive components */}
        <DesignSystemClient />
      </div>
    </div>
  );
}

function ShowcasePanel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl p-6 border border-border bg-card shadow-sm">{children}</div>;
}
