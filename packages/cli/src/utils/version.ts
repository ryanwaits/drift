import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cached: string | undefined;

export function getVersion(): string {
  if (cached) return cached;
  // From source this file sits at src/utils/ (../../package.json); the bundled
  // dist flattens to dist/ (../package.json). Check the name so a stray
  // package.json above the install dir can't win.
  for (const rel of ['../package.json', '../../package.json']) {
    try {
      const pkg = JSON.parse(readFileSync(join(__dirname, rel), 'utf-8'));
      if (pkg.name === '@driftdev/cli' && typeof pkg.version === 'string') {
        cached = pkg.version;
        return cached;
      }
    } catch {
      // keep looking
    }
  }
  cached = '0.0.0';
  return cached;
}
