function Drift() {
  return <span className="font-serif font-semibold text-text">drift</span>;
}

export function FeaturesList() {
  return (
    <section className="relative z-10 mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 text-center">
        <h2 className="font-serif text-4xl tracking-tight text-text sm:text-5xl">
          Features
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-text-muted">
          Ships with everything you need to keep docs in sync with code:
        </p>
      </div>
      <ul className="mt-8 space-y-5 text-base leading-relaxed text-text">
        {features.map((f) => (
          <li key={f.text} className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cta" />
            <span>
              {f.prefix}
              {f.link ? (
                <a
                  href={f.link.href}
                  className="font-medium text-cta transition-opacity hover:opacity-80"
                >
                  {f.link.label}
                </a>
              ) : null}
              {f.suffix}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const features = [
  {
    prefix: "Built on the ",
    link: { label: "TypeScript compiler API", href: "https://github.com/ryanwaits/drift" },
    suffix: " — accurate AST analysis, not regex heuristics",
    text: "ts-compiler",
  },
  {
    prefix: "",
    link: { label: "15 drift detection rules", href: "https://github.com/ryanwaits/drift" },
    suffix: " across structural, semantic, example, and prose categories",
    text: "drift-rules",
  },
  {
    prefix: "",
    link: { label: "Example validation", href: "https://github.com/ryanwaits/drift" },
    suffix: " — type-checks and runs @example blocks in a sandbox",
    text: "example-validation",
  },
  {
    prefix: "",
    link: { label: "Coverage ratchet", href: "https://github.com/ryanwaits/drift" },
    suffix: " prevents documentation regression — coverage can only go up",
    text: "ratchet",
  },
  {
    prefix: "First-class ",
    link: { label: "monorepo support", href: "https://github.com/ryanwaits/drift" },
    suffix: " with auto-detected workspaces and batch analysis",
    text: "monorepo",
  },
  {
    prefix: "",
    link: { label: "GitHub Action", href: "https://github.com/ryanwaits/drift" },
    suffix: " with PR comments, step summaries, and release gates",
    text: "action",
  },
  {
    prefix: "",
    link: { label: "AI-powered doc sync", href: "https://github.com/ryanwaits/drift" },
    suffix: " — auto-generates PRs to update external docs on breaking changes",
    text: "ai-sync",
  },
];
