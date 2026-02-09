import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/drift.ts', 'src/config/index.ts'],
  dts: true,
  clean: true,
  splitting: false,
  format: ['esm'],
  external: ['@doccov/sdk', '@openpkg-ts/spec', 'commander', 'chalk', '@inquirer/prompts'],
});
