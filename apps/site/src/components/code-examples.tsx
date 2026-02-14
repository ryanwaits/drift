'use client';

import { useState } from 'react';
import { ClientDocsKitCode } from '@/components/ui/docskit/code.client-highlight';
import { cn } from '@/lib/utils';

type Variant = {
  id: string;
  label: string;
  code: { value: string; lang: string; meta: string };
};

type Category = {
  id: string;
  label: string;
  variants: Variant[];
};

const categories: Category[] = [
  {
    id: 'cli',
    label: 'CLI',
    variants: [
      {
        id: 'scan',
        label: 'Scan a package',
        code: {
          value: `$ drift scan --min 80

  @driftdev/sdk v0.42.0

  Health     100%
# !expandable
  Coverage   100%  (25/25 exports)
  Lint       0 issues

  ok Scan passed`,
          lang: 'bash',
          meta: 'Terminal -c',
        },
      },
      {
        id: 'scan-all',
        label: 'Scan a monorepo',
        code: {
          value: `$ drift scan --all --min 80

  Package                  Exports  Coverage  Lint  Health

  @driftdev/sdk            25       100%      0     100%
# !expandable
  @driftdev/cli            21       100%      0     100%
  @driftdev/action         18       72%       3     74%
  @driftdev/core           70       96%       0     98%
  @driftdev/shared         127      9%        0     55%
  Skipped 2 private packages

  ✗ Scan failed — minimum health 80`,
          lang: 'bash',
          meta: 'Terminal -c',
        },
      },
      {
        id: 'examples',
        label: 'Validate examples',
        code: {
          value: `$ drift examples

  Examples  4%  ..........  (2/51)

  MISSING
# !expandable
    Account
    AddressVersion
    Client
    ClientConfig
    createClient
    createMultiSigClient
    createPublicClient
    ... +28 more

  Tip: drift examples --typecheck to compile-check examples`,
          lang: 'bash',
          meta: 'Terminal -c',
        },
      },
      {
        id: 'ci',
        label: 'CI pipeline checks',
        code: {
          value: `$ drift ci

  Drift CI

  PACKAGE              EXPORTS  COVERAGE  LINT  STATUS
# !expandable
  @driftdev/sdk        25       100%      0     ok
  @driftdev/cli        21       100%      0     ok
  @driftdev/action     18       72%       3     warn
  @driftdev/core       70       96%       0     ok

  ok All checks passed`,
          lang: 'bash',
          meta: 'Terminal -c',
        },
      },
    ],
  },
  {
    id: 'agent',
    label: 'Agent',
    variants: [
      {
        id: 'drift',
        label: 'Full monorepo audit',
        code: {
          value: `$ /drift

⏺ Scanning monorepo...
  Package          Coverage  Lint  Health
  @driftdev/sdk    88%       1     85
# !expandable
  @driftdev/core   95%       0     98
  @driftdev/action 72%       3     74

⏺ @driftdev/action needs attention at 72%

⏺ Next actions
  /drift enrich --cwd packages/sdk
  /drift enrich --cwd packages/action

✻ Cooked for 47s`,
          lang: 'bash',
          meta: 'Claude Code -c',
        },
      },
      {
        id: 'enrich',
        label: 'Add missing JSDoc',
        code: {
          value: `$ /drift enrich --cwd packages/shared

⏺ Running drift coverage...
  Coverage 9% — 116 undocumented exports

# !expandable
⏺ Reading src/utils/format.ts...
⏺ Adding JSDoc to formatOutput...
  ✓ Added @param, @returns, @example

⏺ Reading src/utils/validate.ts...
⏺ Adding JSDoc to validateInput...
  ✓ Added @param, @returns, @throws

⏺ Progress: 2/116 enriched
  Coverage 9% → 11%

✻ Cooked for 2m 14s`,
          lang: 'bash',
          meta: 'Claude Code -c',
        },
      },
      {
        id: 'fix',
        label: 'Fix stale docs',
        code: {
          value: `$ /drift fix --cwd packages/sdk

⏺ Running drift lint...
  Found 3 issues

# !expandable
⏺ Reading src/config.ts:42...
  ✓ @param options: object → ParseOptions

⏺ Reading src/client.ts:18...
  ✓ @returns Client → Promise<Client>

⏺ Reading src/format.ts:7...
  ✓ Added missing @throws annotation

⏺ Re-running lint...
  ok 0 issues remaining

✻ Cooked for 38s`,
          lang: 'bash',
          meta: 'Claude Code -c',
        },
      },
    ],
  },
  {
    id: 'sdk',
    label: 'SDK',
    variants: [
      {
        id: 'scan',
        label: 'Scan & detect drift',
        code: {
          value: `import { scan } from '@driftdev/sdk'

const spec = await scan('src/index.ts')

console.log(\`Health: \${spec.summary.health?.score}%\`)
console.log(\`Coverage: \${spec.summary.score}%\`)
console.log(\`Drift: \${spec.summary.drift.total} issues\`)`,
          lang: 'typescript',
          meta: 'scan.ts -cn',
        },
      },
      {
        id: 'drift',
        label: 'Inspect per-export drift',
        code: {
          value: `import { scan } from '@driftdev/sdk'

const spec = await scan('src/index.ts')

for (const [id, analysis] of Object.entries(spec.exports)) {
  if (analysis.drift?.length) {
    for (const d of analysis.drift) {
      console.log(\`\${id}: \${d.issue} [\${d.category}]\`)
    }
  }
}`,
          lang: 'typescript',
          meta: 'drift.ts -cn',
        },
      },
      {
        id: 'markdown',
        label: 'Check docs impact',
        code: {
          value: `import { diffSpecWithDocs } from '@driftdev/sdk/markdown'
import { scan } from '@driftdev/sdk'

const oldSpec = await scan('src/index.ts')
// ... make changes ...
const newSpec = await scan('src/index.ts')

const diff = diffSpecWithDocs(oldSpec, newSpec)

if (diff.docsImpact?.impactedFiles.length) {
  console.log('Docs needing updates:')
  for (const f of diff.docsImpact.impactedFiles) {
    console.log(\`  \${f.path}\`)
  }
}`,
          lang: 'typescript',
          meta: 'docs-impact.ts -cn',
        },
      },
    ],
  },
];

export function CodeExamples() {
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);

  const category = categories[categoryIndex];
  const variant = category.variants[variantIndex];

  const handleCategoryChange = (i: number) => {
    setCategoryIndex(i);
    setVariantIndex(0);
  };

  return (
    <section id="overview" className="relative z-10 mx-auto max-w-3xl px-6 py-16 scroll-mt-8">
      <div className="mb-8 text-center">
        <h2 className="font-serif text-4xl tracking-tight text-text sm:text-5xl">Overview</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-text-muted">
          Detect drift, triage issues, and fix docs — from the terminal, your agent, or code.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-page-bg p-1 mb-3">
        {categories.map((cat, i) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryChange(i)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              categoryIndex === i
                ? 'bg-card-bg text-text shadow-sm'
                : 'text-text-muted hover:text-text',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="min-w-0 text-[13px] leading-[1.5] [&>div]:!my-0">
        <ClientDocsKitCode key={`${category.id}-${variant.id}`} codeblock={variant.code} />
      </div>

      {/* Variant bubbles */}
      <div className="mt-3 flex flex-wrap gap-2">
        {category.variants.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVariantIndex(i)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-all',
              variantIndex === i
                ? 'border-cta/40 bg-card-bg text-text'
                : 'border-border bg-page-bg text-text-muted hover:bg-card-bg/60',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </section>
  );
}
