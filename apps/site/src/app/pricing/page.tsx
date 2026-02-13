import { Nav } from '@/components/nav';
import { WavePattern } from '@/components/wave-pattern';

const ctaLinks = {
  cloudPro: 'https://github.com/ryanwaits/drift/issues/new?title=Cloud%20Pro%20Waitlist',
  automation: 'https://github.com/ryanwaits/drift/issues/new?title=Automation%20Pilot%20Request',
  enterprise: 'https://github.com/ryanwaits/drift/issues/new?title=Enterprise%20Inquiry',
};

const tiers = [
  {
    name: 'CLI Free',
    price: '$0',
    subtitle: 'MIT CLI + local CI checks',
    points: [
      'Run scan, lint, coverage, diff, and changelog locally',
      'Use GitHub Action for PR checks in your own workflows',
      'Keep all analysis in your own infrastructure',
    ],
  },
  {
    name: 'Cloud Pro',
    price: '$39/repo/mo',
    subtitle: 'Hosted reporting + alerts',
    points: [
      'Hosted coverage and drift trend dashboards',
      'Org and repo health scorecards with weekly summaries',
      'Slack/email alerts for documentation regressions',
    ],
  },
  {
    name: 'Automation',
    price: '$99/repo/mo',
    subtitle: 'Cross-repo docs sync automation',
    points: [
      'AI-generated docs PRs for breaking API changes',
      'Managed docs.remote targets and execution logs',
      'Approval gates and rollback controls for generated changes',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    subtitle: 'Scale + governance',
    points: [
      'SSO, audit logs, and policy controls',
      'Private VPC/self-hosted deployment options',
      'Commercial SDK licensing and support SLA',
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="relative min-h-screen">
      <WavePattern />
      <Nav />
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-serif text-5xl tracking-tight text-text sm:text-6xl">
            Pricing & Packaging
          </h1>
          <p className="mt-4 text-base text-text-muted sm:text-lg">
            Keep the CLI free. Pay for hosted leverage: org reporting and docs sync automation.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <section
              key={tier.name}
              className="rounded-xl border border-border bg-card-bg p-5 text-sm text-text"
            >
              <h2 className="text-lg font-semibold">{tier.name}</h2>
              <p className="mt-1 text-xl font-semibold text-cta">{tier.price}</p>
              <p className="mt-1 text-text-muted">{tier.subtitle}</p>
              <ul className="mt-4 space-y-2 text-text-muted">
                {tier.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section id="start" className="mt-10 rounded-xl border border-border bg-card-bg p-6 sm:p-8">
          <h2 className="font-serif text-3xl tracking-tight text-text sm:text-4xl">
            Start Hosted Plan Conversion
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-text-muted sm:text-base">
            Run Drift free in CI first, then convert to paid only when reporting and docs automation
            save meaningful team time.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={ctaLinks.cloudPro}
              className="inline-flex h-10 items-center rounded-lg bg-cta px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Join Cloud Pro Waitlist
            </a>
            <a
              href={ctaLinks.automation}
              className="inline-flex h-10 items-center rounded-lg border border-border px-5 text-sm font-medium text-text transition-colors hover:bg-page-bg"
            >
              Request Automation Pilot
            </a>
            <a
              href="/contact"
              className="inline-flex h-10 items-center rounded-lg border border-border px-5 text-sm font-medium text-text transition-colors hover:bg-page-bg"
            >
              Enterprise Contact
            </a>
          </div>
          <ol className="mt-6 grid gap-3 text-sm text-text-muted sm:grid-cols-2">
            <li className="rounded-lg border border-border/80 bg-page-bg p-3">
              1. Gate PRs with <code className="font-mono">drift ci --all --min 80</code>.
            </li>
            <li className="rounded-lg border border-border/80 bg-page-bg p-3">
              2. Baseline docs quality for 1-2 weeks.
            </li>
            <li className="rounded-lg border border-border/80 bg-page-bg p-3">
              3. Join Cloud Pro for org dashboards and alerts.
            </li>
            <li className="rounded-lg border border-border/80 bg-page-bg p-3">
              4. Add Automation for cross-repo docs sync on API changes.
            </li>
          </ol>
        </section>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-text-muted">
          Pricing shown as a starting proposal. Commercial SDK terms follow BUSL + commercial
          licensing for hosted third-party offerings.
        </p>
      </main>
    </div>
  );
}
