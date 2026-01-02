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
    entry: ['src/api/index.ts'],
    outDir: 'dist/api',
    clean: true,
    ...sharedConfig,
  },
  {
    entry: ['src/badge/index.ts'],
    outDir: 'dist/badge',
    ...sharedConfig,
  },
  {
    entry: ['src/docskit/index.ts'],
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
]);
