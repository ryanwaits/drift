import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/drift.ts'],
  dts: false,
  clean: true,
  splitting: false,
  format: ['esm'],
  external: [
    '@driftdev/sdk',
    '@driftdev/clarity-adapter',
    '@driftdev/openapi-adapter',
    '@openpkg-ts/spec',
    'commander',
    'chalk',
    '@inquirer/prompts',
  ],
});
