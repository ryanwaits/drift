function Drift() {
  return <span className="font-serif font-semibold text-text">drift</span>;
}

const features = [
  {
    label: "CLI",
    title: "Scan & Report",
    description: (
      <>
        Run scan to detect missing JSDoc, outdated README sections,
        and undocumented exports across your entire package.
      </>
    ),
  },
  {
    label: "CI/CD",
    title: "GitHub Action",
    description: (
      <>
        Add to your CI pipeline. Block PRs with doc regressions and
        auto-generate fix suggestions as review comments.
      </>
    ),
  },
  {
    label: "SDK",
    title: "Programmatic API",
    description: (
      <>
        Use the TypeScript SDK to build custom doc tooling. Analyze coverage,
        generate reports, and integrate with your workflow.
      </>
    ),
  },
  {
    label: "Spec",
    title: "Coverage Spec",
    description: (
      <>
        A formal specification for measuring documentation coverage. Consistent
        scoring across JSDoc, README, and examples.
      </>
    ),
  },
];

export function FeatureCards() {
  return (
    <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
      {features.map((f) => (
        <div
          key={f.title}
          className="rounded-xl border border-border bg-card-bg p-5 transition-colors hover:border-text-muted/20"
        >
          <span className="mb-3 inline-block rounded-full bg-label/10 px-2.5 py-0.5 text-xs font-medium text-label">
            {f.label}
          </span>
          <h3 className="mb-1.5 text-base font-semibold text-text">
            {f.title}
          </h3>
          <p className="text-sm leading-relaxed text-text-muted">
            {f.description}
          </p>
        </div>
      ))}
    </section>
  );
}
