const features = [
  {
    label: 'Analysis',
    title: 'Drift Detection',
    description: (
      <>
        15 rules across JSDoc, markdown, examples, and prose. Finds every doc that's now wrong.
      </>
    ),
  },
  {
    label: 'CI/CD',
    title: 'CI Ready',
    description: (
      <>
        GitHub Action for PR comments, step summaries, and automated issue creation.
      </>
    ),
  },
  {
    label: 'Agent',
    title: 'Agent-Native',
    description: (
      <>
        Detection is the tool's job. Mutation is the agent's job. Structured JSON output with file
        and line data for AI-driven fixes.
      </>
    ),
  },
  {
    label: 'SDK',
    title: 'Open SDK',
    description: (
      <>
        MIT-licensed analysis engine. Build custom detection and remediation workflows.
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
