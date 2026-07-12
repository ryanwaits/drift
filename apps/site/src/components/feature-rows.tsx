import { getDocAnchor } from '@/lib/docs';

const RULE_TEXTURE: { text: string; top: string; left: string }[] = [
  { text: 'param-mismatch', top: '9%', left: '-6%' },
  { text: 'broken-link', top: '15%', left: '64%' },
  { text: 'param-type-mismatch', top: '22%', left: '28%' },
  { text: 'example-syntax-error', top: '34%', left: '80%' },
  { text: 'return-type-mismatch', top: '45%', left: '-10%' },
  { text: 'prose-deprecated-reference', top: '60%', left: '-14%' },
  { text: 'visibility-mismatch', top: '50%', left: '90%' },
  { text: 'async-mismatch', top: '70%', left: '58%' },
  { text: 'example-drift', top: '78%', left: '6%' },
  { text: 'deprecated-mismatch', top: '86%', left: '18%' },
  { text: 'prose-unresolved-member', top: '92%', left: '66%' },
];

const tileClass =
  'group flex flex-col overflow-hidden rounded-2xl border border-border transition-colors hover:border-border-strong';

export function FeatureRows() {
  const findingHref = getDocAnchor('drift-detection', 'Prose Drift Detection');
  const rulesHref = getDocAnchor('drift-detection', 'The 4 Drift Categories');
  const coverageHref = getDocAnchor('coverage-and-health', 'External Exports');
  const surfacesHref = getDocAnchor('cli-reference', 'drift scan [entry]');

  return (
    <section id="features" className="mx-auto max-w-5xl px-6 py-16 text-center lg:py-20">
      <h2 className="text-2xl font-semibold tracking-tight text-text">See it in action</h2>
      <p className="mx-auto mt-2 max-w-md text-text-muted">
        The actual commands and output — four things drift catches every day.
      </p>

      <div className="mt-10 flex flex-col gap-5 text-left">
        <div className="grid gap-5 sm:grid-cols-3 sm:grid-rows-2">
          {/* flagship: finding */}
          <a
            href={findingHref}
            className={`${tileClass} justify-center pb-6 sm:col-span-2 sm:row-span-2`}
          >
            <div className="px-6 pt-7 text-center sm:px-8">
              <h3 className="text-lg font-semibold tracking-tight text-text">
                Catches outdated code automatically.
              </h3>
              <p className="mx-auto mt-2 max-w-[34ch] text-sm text-text-muted">
                Someone told your docs to call a method that&apos;s already dead. Drift catches it
                and tells you exactly what to use instead.
              </p>
            </div>
            <div className="mx-6 mt-5 overflow-hidden rounded-xl border border-border sm:mx-8">
              <div className="flex items-center justify-between px-4 py-2.5 font-mono text-xs text-text-muted">
                <span>lint · clarinet-sdk</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-code-flag/15 px-2 py-0.5 text-[11px] font-bold text-code-flag">
                  <span className="size-1.5 rounded-full bg-current" />1 finding
                </span>
              </div>
              <pre className="overflow-x-auto bg-code-bg px-4 pb-4 font-mono text-[13px] leading-7 text-text">
                <span className="text-text-muted">$</span> drift lint clarinet-sdk{' '}
                <span className="text-code-key">--docs</span>{' '}
                <span className="text-code-string">guides/</span>
                {'\n\n'}
                <span className="font-bold text-code-flag">prose-deprecated-reference</span>
                {'\n  '}guides/simulate-transactions.md:42
                {'\n  '}
                <span className="text-code-string">simnet.runSnippet(...)</span> is deprecated
                {'\n  '}
                <span className="text-code-fix">→ use simnet.execute(command) instead</span>
              </pre>
            </div>
          </a>

          {/* stat: 17 rules, textured with the real rule names */}
          <a
            href={rulesHref}
            className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-border p-6 text-center transition-colors hover:border-border-strong"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {RULE_TEXTURE.map((item) => (
                <span
                  key={item.text}
                  className="absolute rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-text-muted opacity-40"
                  style={{ top: item.top, left: item.left }}
                >
                  {item.text}
                </span>
              ))}
            </div>
            <span className="relative font-serif text-6xl text-text">17</span>
            <span className="relative mt-1 font-mono text-xs text-text-muted">drift rules</span>
          </a>

          {/* radial viz: coverage */}
          <a
            href={coverageHref}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-border p-6 text-center transition-colors hover:border-border-strong"
          >
            <div
              className="grid size-[84px] place-items-center rounded-full"
              style={{ background: 'conic-gradient(var(--text) 0% 94%, var(--border) 94% 100%)' }}
            >
              <div className="grid size-[62px] place-items-center rounded-full bg-page-bg font-mono text-sm font-bold text-text">
                94%
              </div>
            </div>
            <span className="mt-2 text-sm font-semibold text-text">Coverage that&apos;s fair</span>
            <span className="text-xs text-text-muted">external exports set aside</span>
          </a>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {/* wide: ci */}
          <a href="/docs/ci-integration" className={`${tileClass} pb-6 sm:col-span-2`}>
            <div className="px-6 pt-7 text-center sm:px-8">
              <h3 className="text-lg font-semibold tracking-tight text-text">
                Catches it before it ships.
              </h3>
              <p className="mx-auto mt-2 max-w-[38ch] text-sm text-text-muted">
                Wire drift into CI and every pull request gets checked automatically.
              </p>
            </div>
            <div className="mx-6 mt-5 overflow-hidden rounded-xl border border-border sm:mx-8">
              <div className="flex items-center justify-between px-4 py-2.5 font-mono text-xs text-text-muted">
                <span>ci · pull_request #482</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-code-flag/15 px-2 py-0.5 text-[11px] font-bold text-code-flag">
                  <span className="size-1.5 rounded-full bg-current" />2 issues
                </span>
              </div>
              <pre className="overflow-x-auto bg-code-bg px-4 pb-4 font-mono text-[13px] leading-7 text-text">
                <span className="text-text-muted">$</span> drift ci
                {'\n\n'}
                <span className="font-bold text-code-flag">✕ 2 issues found</span>
                {'\n  '}packages/sdk/scan.ts — missing @param docs
                {'\n  '}guides/quickstart.md — example is out of date
                {'\n\n'}
                <span className="text-code-fix">→ posting summary to PR #482</span>
              </pre>
            </div>
          </a>

          {/* surfaces: straight chip list */}
          <a
            href={surfacesHref}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border p-6 text-center transition-colors hover:border-border-strong"
          >
            <div className="flex w-full max-w-60 flex-col gap-2">
              <div className="rounded-md border border-border-strong bg-code-bg px-3 py-1.5 text-left font-mono text-xs font-semibold text-code-key">
                openpkg-ts
                <span className="font-normal text-text-muted"> — TypeScript, default</span>
              </div>
              <div className="rounded-md border border-border bg-code-bg px-3 py-1.5 text-left font-mono text-xs text-text-muted">
                openapi <span className="text-text-muted/80">— --spec &lt;file|url&gt;</span>
              </div>
              <div className="rounded-md border border-border bg-code-bg px-3 py-1.5 text-left font-mono text-xs text-text-muted">
                your adapter <span className="text-text-muted/80">— converts to ApiSpec</span>
              </div>
            </div>
            <span className="mt-1 text-sm font-semibold text-text">Any typed surface</span>
            <span className="text-xs text-text-muted">same 17 checks, every time</span>
          </a>
        </div>
      </div>
    </section>
  );
}
