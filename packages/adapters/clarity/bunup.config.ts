import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  clean: true,
  format: ['esm'],
  external: ['@driftdev/sdk', '@secondlayer/clarity-docs', '@secondlayer/clarity-types'],
});
