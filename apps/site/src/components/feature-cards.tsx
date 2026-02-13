const features = [
  {
    label: 'CI/CD',
    title: 'PR Gate',
    description: (
      <>
        Run Drift in CI to fail pull requests when docs drift from shipped TypeScript API changes.
      </>
    ),
  },
  {
    label: 'CLI',
    title: 'Triage Fast',
    description: (
      <>
        Use primitives like scan, lint, coverage, and diff to quickly find exactly what broke and
        where.
      </>
    ),
  },
  {
    label: 'Cloud',
    title: 'Hosted Reporting',
    description: (
      <>
        Add a paid hosted layer for drift dashboards, org-level trends, alerts, and multi-repo docs
        sync automation.
      </>
    ),
  },
  {
    label: 'SDK',
    title: 'Automation API',
    description: (
      <>
        Build custom workflows on top of Drift using the SDK and Action for CI checks, release
        gates, and docs updates.
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
          <h3 className="mb-1.5 text-base font-semibold text-text">{f.title}</h3>
          <p className="text-sm leading-relaxed text-text-muted">{f.description}</p>
        </div>
      ))}
    </section>
  );
}
