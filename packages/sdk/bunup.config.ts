import { defineConfig } from 'bunup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/analysis/index.ts',
    'src/types/index.ts',
    'src/markdown/index.ts',
    'src/examples/index.ts',
    'src/history/index.ts',
    'src/cache/index.ts',
  ],
  dts: true,
  clean: true,
  splitting: true,
  format: ['esm'],
  external: ['@openpkg-ts/spec', 'typescript'],
});
