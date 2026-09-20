/**
 * Regression: default `new Drift().analyzeFileWithDiagnostics` on this
 * package's entry used to OOM (OpenPkg followExternal: true expanding zod).
 * Must run under node --max-old-space-size so a regression dies fast.
 */
import { expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Drift } from '../src/analyzer';

const sdkRoot = path.resolve(import.meta.dir, '..');
const dist = path.join(sdkRoot, 'dist/index.js');
const entry = path.join(sdkRoot, 'src/index.ts');

test('default Drift does not enable followExternal', async () => {
  const result = await new Drift({ useCache: false }).analyzeWithDiagnostics(
    'export function f(x: string): string { return x; }',
    'temp.ts',
  );
  expect(result.metadata.resolveExternalTypes).toBe(false);
  expect(result.spec.exports).toHaveLength(1);
});

test(
  'default Drift on packages/sdk/src/index.ts fits a 1gb node heap',
  async () => {
    if (!fs.existsSync(dist)) {
      throw new Error('packages/sdk/dist/index.js missing — bun run build:sdk');
    }

    const script = `
      import { Drift } from ${JSON.stringify(dist)};
      const t = Date.now();
      const { spec } = await new Drift({ useCache: false }).analyzeFileWithDiagnostics(${JSON.stringify(entry)});
      console.log(JSON.stringify({
        ms: Date.now() - t,
        rssMB: Math.round(process.memoryUsage().rss / 1048576),
        exports: spec.exports.length,
      }));
    `;

    const proc = Bun.spawn(
      ['node', '--max-old-space-size=1024', '--input-type=module', '-e', script],
      {
        cwd: sdkRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) {
      throw new Error(`exit ${code}\n${stderr.slice(-1200)}`);
    }
    const result = JSON.parse(stdout) as { ms: number; rssMB: number; exports: number };
    expect(result.exports).toBeGreaterThan(50);
    expect(result.ms).toBeLessThan(15_000);
    expect(result.rssMB).toBeLessThan(1024);
  },
  { timeout: 20_000 },
);
