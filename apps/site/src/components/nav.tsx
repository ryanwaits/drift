import { ShieldBadge } from '@/components/shield-badge';

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-page-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <a href="/" className="font-serif text-2xl text-text">
          drift
        </a>
        <div className="flex items-center gap-5 text-sm">
          <a href="/docs" className="text-text-muted transition-colors hover:text-text">
            Docs
          </a>
          <a
            href="https://github.com/ryanwaits/drift"
            className="text-text-muted transition-colors hover:text-text"
          >
            GitHub
          </a>
          <a href="/changelog" className="text-text-muted transition-colors hover:text-text">
            Changelog
          </a>
          <div className="hidden items-center gap-1.5 border-l border-border pl-5 sm:flex">
            <ShieldBadge label="coverage" value="100%" variant="green" />
            <ShieldBadge label="license" value="MIT" />
          </div>
        </div>
      </div>
    </nav>
  );
}
