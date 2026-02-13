import { PackageInstall } from '@/components/ui/docskit';

async function getStarCount(): Promise<string> {
  try {
    const res = await fetch('https://api.github.com/repos/ryanwaits/drift', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return '—';
    const data = await res.json();
    const count = data.stargazers_count as number;
    return count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(count);
  } catch {
    return '—';
  }
}

export async function Hero() {
  const stars = await getStarCount();
  return (
    <section className="relative z-10 mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:gap-16 lg:py-32">
      {/* Left — title + CTA */}
      <div className="flex flex-col justify-center">
        <h1 className="font-serif text-7xl leading-[0.9] tracking-tight text-text sm:text-8xl lg:text-9xl">
          drift
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-text-muted">
          Fail PRs when docs drift. Drift checks exported TypeScript APIs for JSDoc accuracy,
          missing coverage, and stale markdown references in your{' '}
          <span className="font-medium text-text">CI pipeline</span>.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#overview"
            className="inline-flex h-10 items-center rounded-lg bg-cta px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Gate PRs in CI
          </a>
          <a
            href="/pricing#start"
            className="inline-flex h-10 items-center rounded-lg border border-border px-5 text-sm font-medium text-text transition-colors hover:bg-card-bg"
          >
            Join Cloud Waitlist
          </a>
          <a
            href="https://github.com/ryanwaits/drift/tree/main/docs"
            className="inline-flex h-10 items-center rounded-lg border border-border px-5 text-sm font-medium text-text transition-colors hover:bg-card-bg"
          >
            View Docs
          </a>
        </div>
      </div>

      {/* Right — install block + badges */}
      <div className="flex flex-col justify-center gap-0">
        <h4 className="font-serif text-2xl tracking-tight text-text">Installation</h4>
        <PackageInstall package="@driftdev/cli" dev managers={['bun', 'npm', 'pnpm']} copyButton />
        <div className="flex flex-wrap gap-3">
          <ShieldBadge label="stars" value={stars} />
          <ShieldBadge label="coverage" value="100%" variant="green" />
          <ShieldBadge label="license" value="MIT + BUSL" />
        </div>
      </div>
    </section>
  );
}

function ShieldBadge({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string;
  variant?: 'default' | 'green';
}) {
  return (
    <span className="inline-flex items-center overflow-hidden rounded-md border border-border text-xs font-medium">
      <span
        className={
          variant === 'green'
            ? 'bg-[#2d3a2e] px-2.5 py-1 text-green-200'
            : 'bg-card-bg px-2.5 py-1 text-text-muted'
        }
      >
        {label}
      </span>
      <span
        className={
          variant === 'green' ? 'bg-green-100 px-2.5 py-1 text-green-700' : 'px-2.5 py-1 text-text'
        }
      >
        {value}
      </span>
    </span>
  );
}
