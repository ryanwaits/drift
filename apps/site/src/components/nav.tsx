export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-page-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <a href="/" className="font-serif text-2xl text-text">
            drift
          </a>
          <div className="hidden items-center gap-1 rounded-lg border border-border bg-card-bg px-3 py-1.5 text-sm text-text-muted sm:flex">
            <SearchIcon />
            <span className="ml-1">Search...</span>
            <kbd className="ml-6 rounded border border-border bg-page-bg px-1.5 py-0.5 font-mono text-xs text-text-muted">
              /
            </kbd>
          </div>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <a
            href="https://github.com/ryanwaits/drift/tree/main/docs"
            className="text-text-muted transition-colors hover:text-text"
          >
            Docs
          </a>
          <a
            href="https://github.com/ryanwaits/drift"
            className="text-text-muted transition-colors hover:text-text"
          >
            GitHub
          </a>
          <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs text-text-muted">
            v0.42.0
          </span>
        </div>
      </div>
    </nav>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Search"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Search</title>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
