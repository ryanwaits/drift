import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { WavePattern } from '@/components/wave-pattern';

const paths = [
  {
    title: 'Cloud Pro Waitlist',
    detail: 'Hosted dashboards and alerting for docs quality across repos.',
    href: 'https://github.com/ryanwaits/drift/issues/new?title=Cloud%20Pro%20Waitlist',
    cta: 'Join Waitlist',
  },
  {
    title: 'Automation Pilot',
    detail: 'Managed docs-sync PR automation for breaking API changes.',
    href: 'https://github.com/ryanwaits/drift/issues/new?title=Automation%20Pilot%20Request',
    cta: 'Request Pilot',
  },
  {
    title: 'Enterprise Inquiry',
    detail: 'SSO, governance, support, and deployment requirements.',
    href: 'https://github.com/ryanwaits/drift/issues/new?title=Enterprise%20Inquiry',
    cta: 'Contact Sales',
  },
];

export const metadata: Metadata = {
  title: 'Contact Drift Hosted Plans',
  description: 'Join the waitlist or request a hosted plan pilot for Drift Cloud and Automation.',
};

export default function ContactPage() {
  return (
    <div className="relative min-h-screen">
      <WavePattern />
      <Nav />
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-serif text-5xl tracking-tight text-text sm:text-6xl">
            Contact & Waitlist
          </h1>
          <p className="mt-4 text-base text-text-muted sm:text-lg">
            Pick your path from free CLI usage to hosted Drift plans.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paths.map((path) => (
            <section key={path.title} className="rounded-xl border border-border bg-card-bg p-5">
              <h2 className="text-lg font-semibold text-text">{path.title}</h2>
              <p className="mt-2 text-sm text-text-muted">{path.detail}</p>
              <a
                href={path.href}
                className="mt-5 inline-flex h-10 items-center rounded-lg bg-cta px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {path.cta}
              </a>
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-xl border border-border bg-card-bg p-6">
          <h2 className="font-serif text-3xl tracking-tight text-text">Conversion Flow</h2>
          <ol className="mt-4 grid gap-3 text-sm text-text-muted sm:grid-cols-2">
            <li className="rounded-lg border border-border/80 bg-page-bg p-3">
              1. Start with free CI gates using{' '}
              <code className="font-mono">drift ci --all --min 80</code>.
            </li>
            <li className="rounded-lg border border-border/80 bg-page-bg p-3">
              2. Track drift and coverage trends for 1-2 weeks.
            </li>
            <li className="rounded-lg border border-border/80 bg-page-bg p-3">
              3. Convert to Cloud Pro for hosted reporting and alerts.
            </li>
            <li className="rounded-lg border border-border/80 bg-page-bg p-3">
              4. Add Automation or Enterprise based on scale and governance needs.
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
