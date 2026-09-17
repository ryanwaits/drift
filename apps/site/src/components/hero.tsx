import { HeroInstall } from '@/components/hero-install';
import { SkillCopyLine } from '@/components/skill-copy-line';
import { getChangelogEntries } from '@/lib/changelog';

const SKILL_INSTALL_COMMAND = 'bunx skills add ryanwaits/drift';

export function Hero() {
  const latest = getChangelogEntries()[0]?.version;

  return (
    <section className="relative z-10 mx-auto max-w-2xl px-6 pt-10 pb-16 text-center lg:pt-14 lg:pb-24">
      <p className="mb-5 flex flex-nowrap items-center justify-center gap-2 text-sm text-text-muted">
        <span className="shrink-0 rounded bg-text px-2 py-0.5 font-mono text-xs font-bold text-page-bg">
          New
        </span>
        <span className="min-w-0 truncate">
          {latest ? <b className="font-medium text-text">v{latest}</b> : null}
          {latest ? ' — ' : null}
          one check, locally and in CI. No model.
        </span>
        <a
          href="/changelog"
          className="shrink-0 underline decoration-border-strong underline-offset-2 transition-colors hover:text-text hover:decoration-text"
        >
          View changelog →
        </a>
      </p>

      <h1 className="font-serif text-7xl leading-[0.92] tracking-tight text-text sm:text-8xl lg:text-9xl">
        drift
      </h1>
      <p className="mx-auto mt-5 max-w-md text-xl text-text">
        Code changes. Docs don&apos;t. Drift catches it.
      </p>

      <div className="mt-8">
        <HeroInstall />
      </div>

      <p className="mx-auto mt-3 max-w-md text-sm text-text-muted">
        For agents: <SkillCopyLine command={SKILL_INSTALL_COMMAND} />
      </p>
    </section>
  );
}
