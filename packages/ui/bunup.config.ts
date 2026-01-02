import { defineConfig } from 'bunup';

const sharedConfig = {
  dts: true,
  format: ['esm'] as const,
  target: 'browser' as const,
  external: [
    'react',
    'react-dom',
    'clsx',
    'tailwind-merge',
    'class-variance-authority',
    'lucide-react',
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
};

export default defineConfig([
  {
    entry: ['src/components/api/index.ts'],
    outDir: 'dist/api',
    clean: true,
    ...sharedConfig,
  },
  {
    entry: ['src/components/docskit/index.ts'],
    outDir: 'dist/docskit',
    ...sharedConfig,
  },
  {
    entry: ['src/lib/utils.ts'],
    outDir: 'dist/lib',
    dts: true,
    format: ['esm'],
    target: 'browser',
    external: ['clsx', 'tailwind-merge'],
  },
  {
    entry: ['src/components/button/index.ts'],
    outDir: 'dist/button',
    ...sharedConfig,
  },
  {
    entry: ['src/components/badge/index.ts'],
    outDir: 'dist/badge',
    ...sharedConfig,
  },
  {
    entry: ['src/components/breadcrumb/index.ts'],
    outDir: 'dist/breadcrumb',
    ...sharedConfig,
  },
  {
    entry: ['src/components/input/index.ts'],
    outDir: 'dist/input',
    ...sharedConfig,
  },
  {
    entry: ['src/components/tabs/index.ts'],
    outDir: 'dist/tabs',
    ...sharedConfig,
  },
  {
    entry: ['src/components/file-chip/index.ts'],
    outDir: 'dist/file-chip',
    ...sharedConfig,
  },
  {
    entry: ['src/components/file-change-row/index.ts'],
    outDir: 'dist/file-change-row',
    ...sharedConfig,
  },
  {
    entry: ['src/components/coverage-trends/index.ts'],
    outDir: 'dist/coverage-trends',
    ...sharedConfig,
    external: [...sharedConfig.external, 'recharts'],
  },
]);
