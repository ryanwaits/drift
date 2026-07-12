export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
        <span className="text-sm text-text-muted">
          MIT licensed. Works with TypeScript, OpenAPI, and Clarity.
        </span>
        <div className="flex gap-6 text-sm text-text-muted">
          <a href="/changelog" className="hover:text-text">
            Changelog
          </a>
          <a href="/docs" className="hover:text-text">
            Docs
          </a>
          <a href="https://github.com/ryanwaits/drift" className="hover:text-text">
            GitHub
          </a>
          <a href="/docs/action" className="hover:text-text">
            Action
          </a>
        </div>
      </div>
    </footer>
  );
}
